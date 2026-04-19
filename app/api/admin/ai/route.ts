import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import Anthropic from '@anthropic-ai/sdk'
import { prisma } from '@/app/lib/prisma'
import {
  type Segment,
  SEGMENT_LABELS,
  segmentWhere,
} from '@/app/lib/customer-segments'

async function checkAdmin(): Promise<boolean> {
  const cookieStore = await cookies()
  return cookieStore.get('sm_admin')?.value === 'sm_authenticated'
}

// ── Tool definitions for Claude ──────────────────────────────────────────

const tools: Anthropic.Tool[] = [
  {
    name: 'list_categories',
    description: 'List all product categories (e.g. Lip Care, Beard Care, Bath & Body)',
    input_schema: { type: 'object' as const, properties: {}, required: [] },
  },
  {
    name: 'list_scents',
    description: 'List all available scents in the scent library',
    input_schema: { type: 'object' as const, properties: {}, required: [] },
  },
  {
    name: 'search_products',
    description: 'Search for existing products by name or scent. Returns product details with variants and stock.',
    input_schema: {
      type: 'object' as const,
      properties: {
        query: { type: 'string', description: 'Search term to match against product name or scent' },
      },
      required: ['query'],
    },
  },
  {
    name: 'create_product',
    description:
      'Create a new product with variants. Use this when Melly wants to add a completely new product. Each variant can be a scent or a size.',
    input_schema: {
      type: 'object' as const,
      properties: {
        name: { type: 'string', description: 'Product name, e.g. "Lip Balm"' },
        categoryName: {
          type: 'string',
          description: 'Category name (must match an existing category). Use list_categories first if unsure.',
        },
        scent: {
          type: 'string',
          description: 'Scent name if this is a single-scent product. Leave empty for multi-scent products where each variant is a different scent.',
        },
        description: { type: 'string', description: 'Product description' },
        ingredients: { type: 'string', description: 'Comma-separated ingredient list for the back label' },
        isFeatured: { type: 'boolean', description: 'Whether to feature on the homepage' },
        variants: {
          type: 'array',
          description: 'Product variants (scents or sizes)',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string', description: 'Variant name — either a scent name or size (e.g. "Lavender Dreams" or "8oz Tin")' },
              priceCents: { type: 'number', description: 'Price in cents (e.g. 1200 for $12.00)' },
              costCents: { type: 'number', description: 'Cost in cents (optional)' },
              weightOz: { type: 'number', description: 'Weight in ounces (optional)' },
              stockQuantity: { type: 'number', description: 'Initial stock count' },
              sku: { type: 'string', description: 'SKU code (optional)' },
            },
            required: ['name', 'priceCents', 'stockQuantity'],
          },
        },
      },
      required: ['name', 'categoryName', 'variants'],
    },
  },
  {
    name: 'add_variants_to_product',
    description: 'Add new variants (scents/sizes) to an existing product. Search for the product first to get its ID.',
    input_schema: {
      type: 'object' as const,
      properties: {
        productId: { type: 'string', description: 'The product ID to add variants to' },
        variants: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string', description: 'Variant name' },
              priceCents: { type: 'number', description: 'Price in cents' },
              costCents: { type: 'number', description: 'Cost in cents (optional)' },
              weightOz: { type: 'number', description: 'Weight in oz (optional)' },
              stockQuantity: { type: 'number', description: 'Initial stock' },
              sku: { type: 'string', description: 'SKU (optional)' },
            },
            required: ['name', 'priceCents', 'stockQuantity'],
          },
        },
      },
      required: ['productId', 'variants'],
    },
  },
  {
    name: 'adjust_inventory',
    description: 'Set the stock quantity for a specific product variant. Search for the product first to find variant IDs.',
    input_schema: {
      type: 'object' as const,
      properties: {
        variantId: { type: 'string', description: 'The variant ID' },
        stockQuantity: { type: 'number', description: 'New stock quantity to set' },
      },
      required: ['variantId', 'stockQuantity'],
    },
  },
  {
    name: 'update_product',
    description: 'Update product fields like name, description, ingredients, scent, active status, or featured status.',
    input_schema: {
      type: 'object' as const,
      properties: {
        productId: { type: 'string', description: 'Product ID to update' },
        name: { type: 'string' },
        description: { type: 'string' },
        ingredients: { type: 'string' },
        scent: { type: 'string' },
        isActive: { type: 'boolean' },
        isFeatured: { type: 'boolean' },
      },
      required: ['productId'],
    },
  },
  {
    name: 'create_material',
    description: 'Add a raw material to the materials inventory for recipe cost calculations.',
    input_schema: {
      type: 'object' as const,
      properties: {
        name: { type: 'string', description: 'Material name, e.g. "Shea Butter"' },
        packageCostDollars: { type: 'number', description: 'Package cost in dollars, e.g. 12.99' },
        packageSize: { type: 'number', description: 'Package size, e.g. 16' },
        packageUnit: {
          type: 'string',
          description: 'Unit: oz, g, lb, kg, fl_oz, ml, L, cups, tbsp, tsp, drops, count',
        },
        supplier: { type: 'string', description: 'Where she buys it (optional)' },
        notes: { type: 'string', description: 'Any notes (optional)' },
      },
      required: ['name', 'packageCostDollars', 'packageSize', 'packageUnit'],
    },
  },
  {
    name: 'list_materials',
    description: 'List all raw materials in inventory',
    input_schema: { type: 'object' as const, properties: {}, required: [] },
  },
  {
    name: 'get_inventory_summary',
    description: 'Get a summary of inventory: low stock items, out of stock items, total counts.',
    input_schema: { type: 'object' as const, properties: {}, required: [] },
  },
  {
    name: 'generate_description',
    description:
      'Generate a nice, appealing product description for the storefront. Looks up the product details and writes marketing copy. Can also update the product description directly.',
    input_schema: {
      type: 'object' as const,
      properties: {
        productId: { type: 'string', description: 'Product ID to generate a description for' },
        saveToProduct: {
          type: 'boolean',
          description: 'If true, saves the generated description directly to the product. If false, just returns it for review.',
        },
        tone: {
          type: 'string',
          description: 'Tone of the description: "fun" (playful/casual), "luxe" (upscale/spa-like), "simple" (straightforward). Defaults to "fun".',
        },
      },
      required: ['productId'],
    },
  },
  {
    name: 'create_scent',
    description: 'Add a new scent to the scent library so it can be used when creating products.',
    input_schema: {
      type: 'object' as const,
      properties: {
        name: { type: 'string', description: 'Scent name, e.g. "Lavender Dreams"' },
      },
      required: ['name'],
    },
  },
  {
    name: 'delete_scent',
    description: 'Delete or deactivate a scent from the scent library.',
    input_schema: {
      type: 'object' as const,
      properties: {
        name: { type: 'string', description: 'Scent name to remove' },
      },
      required: ['name'],
    },
  },

  // ── CRM tools ─────────────────────────────────────────────────────────
  {
    name: 'list_customers',
    description:
      'List customers with optional filters. Use this to answer questions like "who are my top customers?", "who hasn\'t ordered in a while?", "who\'s tagged wholesale?". Returns up to `limit` results (default 20), sorted by lifetime spend descending.',
    input_schema: {
      type: 'object' as const,
      properties: {
        segment: {
          type: 'string',
          enum: [
            'all',
            'repeat',
            'big_spenders',
            'dormant',
            'pickup_only',
            'has_shipped',
            'new',
          ],
          description:
            'Smart segment filter. repeat=2+ orders; big_spenders=$100+ lifetime; dormant=last order 90+ days ago; pickup_only=never shipped; has_shipped=at least one ship order; new=first order within 30 days.',
        },
        search: {
          type: 'string',
          description: 'Case-insensitive substring match on customer name or email.',
        },
        tag: {
          type: 'string',
          description: 'Only return customers tagged with this exact tag name.',
        },
        limit: {
          type: 'number',
          description: 'Max results to return (default 20, max 100).',
        },
      },
      required: [],
    },
  },
  {
    name: 'get_customer',
    description:
      'Look up one customer by email or ID. Returns profile, stats, notes, tags, and the last 10 orders.',
    input_schema: {
      type: 'object' as const,
      properties: {
        email: { type: 'string', description: 'Customer email (case-insensitive).' },
        customerId: { type: 'string', description: 'Customer ID if known.' },
      },
      required: [],
    },
  },
  {
    name: 'customer_segments_summary',
    description:
      'Get counts across every smart segment — useful for a CRM overview ("how many dormant customers do I have?", "what does my customer base look like?").',
    input_schema: { type: 'object' as const, properties: {}, required: [] },
  },
  {
    name: 'append_customer_note',
    description:
      'Append a line to a customer\'s notes (non-destructive — preserves existing notes). Prefixed with the current date.',
    input_schema: {
      type: 'object' as const,
      properties: {
        email: { type: 'string', description: 'Customer email' },
        customerId: { type: 'string', description: 'Customer ID (alternative to email)' },
        note: { type: 'string', description: 'Note to append' },
      },
      required: ['note'],
    },
  },
  {
    name: 'add_customer_tag',
    description:
      'Tag a customer. Creates the tag if it doesn\'t exist yet (with a random brand color).',
    input_schema: {
      type: 'object' as const,
      properties: {
        email: { type: 'string', description: 'Customer email' },
        customerId: { type: 'string', description: 'Customer ID (alternative to email)' },
        tagName: { type: 'string', description: 'Tag name to apply' },
      },
      required: ['tagName'],
    },
  },
  {
    name: 'remove_customer_tag',
    description: 'Remove a tag from a customer.',
    input_schema: {
      type: 'object' as const,
      properties: {
        email: { type: 'string', description: 'Customer email' },
        customerId: { type: 'string', description: 'Customer ID (alternative to email)' },
        tagName: { type: 'string', description: 'Tag name to remove' },
      },
      required: ['tagName'],
    },
  },
  {
    name: 'list_tags',
    description:
      'List every tag in the system with a count of how many customers carry it.',
    input_schema: { type: 'object' as const, properties: {}, required: [] },
  },
]

// ── Tool execution ───────────────────────────────────────────────────────

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

function money(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`
}

// Resolve a customer from either `email` or `customerId` inputs. The AI tools
// accept either so Claude can pass whichever the user provided.
async function resolveCustomer(
  input: { email?: string; customerId?: string },
): Promise<{ id: string; name: string; email: string } | null> {
  if (input.customerId) {
    return prisma.sM_Customer.findUnique({
      where: { id: input.customerId },
      select: { id: true, name: true, email: true },
    })
  }
  if (input.email) {
    return prisma.sM_Customer.findUnique({
      where: { email: input.email.trim().toLowerCase() },
      select: { id: true, name: true, email: true },
    })
  }
  return null
}

const BRAND_TAG_COLORS = [
  '#C67D4A',
  '#8a7360',
  '#5b4a3a',
  '#2e7d5c',
  '#b8454b',
  '#4a6fa5',
]

async function executeTool(
  name: string,
  input: Record<string, any>,
  client: Anthropic,
): Promise<string> {
  switch (name) {
    case 'list_categories': {
      const cats = await prisma.sM_Category.findMany({
        where: { isActive: true },
        orderBy: { sortOrder: 'asc' },
      })
      return JSON.stringify(cats.map((c) => ({ id: c.id, name: c.name })))
    }

    case 'list_scents': {
      const scents = await prisma.sM_Scent.findMany({
        where: { isActive: true },
        orderBy: { name: 'asc' },
      })
      return JSON.stringify(scents.map((s) => ({ id: s.id, name: s.name })))
    }

    case 'search_products': {
      const products = await prisma.sM_Product.findMany({
        where: {
          OR: [
            { name: { contains: input.query, mode: 'insensitive' } },
            { scent: { contains: input.query, mode: 'insensitive' } },
            { variants: { some: { name: { contains: input.query, mode: 'insensitive' } } } },
          ],
        },
        include: {
          category: { select: { name: true } },
          variants: {
            orderBy: { name: 'asc' },
            select: {
              id: true,
              name: true,
              priceCents: true,
              stockQuantity: true,
              isActive: true,
              sku: true,
            },
          },
        },
        take: 10,
      })
      return JSON.stringify(
        products.map((p) => ({
          id: p.id,
          name: p.name,
          scent: p.scent,
          category: p.category.name,
          isActive: p.isActive,
          variants: p.variants.map((v) => ({
            id: v.id,
            name: v.name,
            price: `$${(v.priceCents / 100).toFixed(2)}`,
            stock: v.stockQuantity,
            isActive: v.isActive,
            sku: v.sku,
          })),
        })),
      )
    }

    case 'create_product': {
      // Find the category
      const category = await prisma.sM_Category.findFirst({
        where: { name: { equals: input.categoryName, mode: 'insensitive' } },
      })
      if (!category) {
        // Try to create it
        const newCat = await prisma.sM_Category.create({
          data: {
            name: input.categoryName,
            slug: slugify(input.categoryName),
          },
        })
        input._categoryId = newCat.id
      } else {
        input._categoryId = category.id
      }

      const product = await prisma.sM_Product.create({
        data: {
          name: input.name,
          slug: slugify(`${input.name}-${input.scent || Date.now()}`),
          scent: input.scent || null,
          description: input.description || null,
          ingredients: input.ingredients || null,
          categoryId: input._categoryId,
          isFeatured: input.isFeatured ?? false,
          variants: {
            create: (input.variants || []).map((v: any) => ({
              name: v.name,
              priceCents: v.priceCents,
              costCents: v.costCents ?? null,
              weightOz: v.weightOz ?? null,
              stockQuantity: v.stockQuantity ?? 0,
              sku: v.sku || null,
            })),
          },
        },
        include: {
          category: { select: { name: true } },
          variants: { select: { name: true, priceCents: true, stockQuantity: true } },
        },
      })

      return JSON.stringify({
        success: true,
        product: {
          id: product.id,
          name: product.name,
          scent: product.scent,
          category: product.category.name,
          variants: product.variants.map((v) => ({
            name: v.name,
            price: `$${(v.priceCents / 100).toFixed(2)}`,
            stock: v.stockQuantity,
          })),
        },
      })
    }

    case 'add_variants_to_product': {
      const product = await prisma.sM_Product.findUnique({
        where: { id: input.productId },
        select: { name: true },
      })
      if (!product) return JSON.stringify({ error: 'Product not found' })

      const created = []
      for (const v of input.variants) {
        const variant = await prisma.sM_ProductVariant.create({
          data: {
            productId: input.productId,
            name: v.name,
            priceCents: v.priceCents,
            costCents: v.costCents ?? null,
            weightOz: v.weightOz ?? null,
            stockQuantity: v.stockQuantity ?? 0,
            sku: v.sku || null,
          },
        })
        created.push({ id: variant.id, name: variant.name, stock: variant.stockQuantity })
      }

      return JSON.stringify({
        success: true,
        product: product.name,
        addedVariants: created,
      })
    }

    case 'adjust_inventory': {
      const variant = await prisma.sM_ProductVariant.update({
        where: { id: input.variantId },
        data: { stockQuantity: input.stockQuantity },
        include: { product: { select: { name: true } } },
      })
      return JSON.stringify({
        success: true,
        product: variant.product.name,
        variant: variant.name,
        newStock: variant.stockQuantity,
      })
    }

    case 'update_product': {
      const data: any = {}
      if (input.name !== undefined) data.name = input.name
      if (input.description !== undefined) data.description = input.description || null
      if (input.ingredients !== undefined) data.ingredients = input.ingredients || null
      if (input.scent !== undefined) data.scent = input.scent || null
      if (input.isActive !== undefined) data.isActive = input.isActive
      if (input.isFeatured !== undefined) data.isFeatured = input.isFeatured

      const product = await prisma.sM_Product.update({
        where: { id: input.productId },
        data,
        select: { id: true, name: true, scent: true, isActive: true, isFeatured: true },
      })
      return JSON.stringify({ success: true, product })
    }

    case 'create_material': {
      const material = await prisma.sM_Material.create({
        data: {
          name: input.name,
          packageCostCents: Math.round(input.packageCostDollars * 100),
          packageSize: input.packageSize,
          packageUnit: input.packageUnit,
          supplier: input.supplier || null,
          notes: input.notes || null,
        },
      })
      return JSON.stringify({
        success: true,
        material: {
          id: material.id,
          name: material.name,
          package: `${material.packageSize} ${material.packageUnit}`,
          cost: `$${(material.packageCostCents / 100).toFixed(2)}`,
        },
      })
    }

    case 'list_materials': {
      const materials = await prisma.sM_Material.findMany({
        where: { isActive: true },
        orderBy: { name: 'asc' },
      })
      return JSON.stringify(
        materials.map((m) => ({
          id: m.id,
          name: m.name,
          package: `${m.packageSize} ${m.packageUnit}`,
          cost: `$${(m.packageCostCents / 100).toFixed(2)}`,
          supplier: m.supplier,
        })),
      )
    }

    case 'get_inventory_summary': {
      const variants = await prisma.sM_ProductVariant.findMany({
        where: { isActive: true },
        include: { product: { select: { name: true } } },
        orderBy: { stockQuantity: 'asc' },
      })

      const outOfStock = variants.filter((v) => v.stockQuantity === 0)
      const lowStock = variants.filter(
        (v) => v.stockQuantity > 0 && v.stockQuantity <= v.lowStockAt,
      )

      return JSON.stringify({
        totalVariants: variants.length,
        totalInStock: variants.reduce((s, v) => s + v.stockQuantity, 0),
        outOfStock: outOfStock.map((v) => ({
          product: v.product.name,
          variant: v.name,
        })),
        lowStock: lowStock.map((v) => ({
          product: v.product.name,
          variant: v.name,
          stock: v.stockQuantity,
          threshold: v.lowStockAt,
        })),
      })
    }

    case 'generate_description': {
      const product = await prisma.sM_Product.findUnique({
        where: { id: input.productId },
        include: {
          category: { select: { name: true } },
          variants: { select: { name: true }, where: { isActive: true } },
        },
      })
      if (!product) return JSON.stringify({ error: 'Product not found' })

      const tone = input.tone || 'fun'
      const toneGuide =
        tone === 'luxe'
          ? 'Write in an upscale, spa-like, indulgent tone. Think luxury bath products.'
          : tone === 'simple'
            ? 'Write in a straightforward, no-nonsense tone. Keep it brief.'
            : 'Write in a fun, playful, casual tone. Be personable and charming.'

      const descPrompt = `Write a short product description (2-3 sentences max) for an online store listing. ${toneGuide}

Product: ${product.name}
Category: ${product.category.name}
${product.scent ? `Scent: ${product.scent}` : `Available scents: ${product.variants.map((v) => v.name).join(', ')}`}
${product.ingredients ? `Key ingredients: ${product.ingredients}` : ''}

The business is "Smelly Melly" — a small handmade bath & body products business. All products are handmade with love. Do NOT include the product name or "Smelly Melly" in the description — those are already shown on the page. Just describe the product itself.`

      const descResponse = await client.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 256,
        messages: [{ role: 'user', content: descPrompt }],
      })

      const description = (descResponse.content[0] as Anthropic.TextBlock).text.trim()

      if (input.saveToProduct) {
        await prisma.sM_Product.update({
          where: { id: input.productId },
          data: { description },
        })
        return JSON.stringify({
          success: true,
          saved: true,
          product: product.name,
          description,
        })
      }

      return JSON.stringify({
        success: true,
        saved: false,
        product: product.name,
        description,
      })
    }

    case 'create_scent': {
      try {
        const scent = await prisma.sM_Scent.create({
          data: { name: input.name.trim() },
        })
        return JSON.stringify({ success: true, scent: { id: scent.id, name: scent.name } })
      } catch (e: any) {
        if (e?.code === 'P2002') {
          return JSON.stringify({ error: `Scent "${input.name}" already exists` })
        }
        throw e
      }
    }

    case 'delete_scent': {
      const scent = await prisma.sM_Scent.findFirst({
        where: { name: { equals: input.name, mode: 'insensitive' } },
      })
      if (!scent) return JSON.stringify({ error: `Scent "${input.name}" not found` })
      await prisma.sM_Scent.update({
        where: { id: scent.id },
        data: { isActive: false },
      })
      return JSON.stringify({ success: true, deactivated: scent.name })
    }

    // ── CRM tools ────────────────────────────────────────────────────────

    case 'list_customers': {
      const segment: Segment = (input.segment as Segment) || 'all'
      const limit = Math.min(Math.max(input.limit || 20, 1), 100)
      const baseWhere = segmentWhere(segment, input.search || undefined)
      const where = input.tag
        ? {
            AND: [
              baseWhere,
              {
                tags: {
                  some: {
                    tag: { name: { equals: input.tag, mode: 'insensitive' as const } },
                  },
                },
              },
            ],
          }
        : baseWhere

      const customers = await prisma.sM_Customer.findMany({
        where,
        orderBy: [{ totalSpentCents: 'desc' }, { lastOrderAt: 'desc' }],
        take: limit,
        include: {
          tags: { include: { tag: { select: { name: true } } } },
        },
      })

      return JSON.stringify({
        segment,
        segmentLabel: SEGMENT_LABELS[segment],
        count: customers.length,
        customers: customers.map((c) => ({
          id: c.id,
          name: c.name,
          email: c.email,
          phone: c.phone,
          orderCount: c.orderCount,
          lifetimeSpend: money(c.totalSpentCents),
          firstOrderAt: c.firstOrderAt?.toISOString() ?? null,
          lastOrderAt: c.lastOrderAt?.toISOString() ?? null,
          tags: c.tags.map((t) => t.tag.name),
        })),
      })
    }

    case 'get_customer': {
      const resolved = await resolveCustomer(input)
      if (!resolved) {
        return JSON.stringify({
          error: 'Customer not found. Provide email or customerId.',
        })
      }
      const full = await prisma.sM_Customer.findUnique({
        where: { id: resolved.id },
        include: {
          tags: { include: { tag: true } },
          orders: {
            orderBy: { createdAt: 'desc' },
            take: 10,
            select: {
              id: true,
              orderNumber: true,
              status: true,
              fulfillment: true,
              totalCents: true,
              createdAt: true,
            },
          },
        },
      })
      if (!full) return JSON.stringify({ error: 'Customer vanished mid-query' })
      return JSON.stringify({
        id: full.id,
        name: full.name,
        email: full.email,
        phone: full.phone,
        notes: full.notes,
        stats: {
          orderCount: full.orderCount,
          lifetimeSpend: money(full.totalSpentCents),
          firstOrderAt: full.firstOrderAt?.toISOString() ?? null,
          lastOrderAt: full.lastOrderAt?.toISOString() ?? null,
        },
        tags: full.tags.map((t) => ({ name: t.tag.name, color: t.tag.color })),
        lastShipTo: full.lastShipAddress
          ? {
              name: full.lastShipName,
              address: full.lastShipAddress,
              city: full.lastShipCity,
              state: full.lastShipState,
              zip: full.lastShipZip,
            }
          : null,
        recentOrders: full.orders.map((o) => ({
          id: o.id,
          orderNumber: o.orderNumber,
          status: o.status,
          fulfillment: o.fulfillment,
          total: money(o.totalCents),
          createdAt: o.createdAt.toISOString(),
        })),
      })
    }

    case 'customer_segments_summary': {
      const segments: Segment[] = [
        'all',
        'repeat',
        'big_spenders',
        'dormant',
        'pickup_only',
        'has_shipped',
        'new',
      ]
      const counts: Record<string, number> = {}
      for (const s of segments) {
        counts[s] = await prisma.sM_Customer.count({ where: segmentWhere(s) })
      }
      return JSON.stringify({
        totals: counts,
        labels: SEGMENT_LABELS,
      })
    }

    case 'append_customer_note': {
      const resolved = await resolveCustomer(input)
      if (!resolved) {
        return JSON.stringify({
          error: 'Customer not found. Provide email or customerId.',
        })
      }
      if (!input.note?.trim()) {
        return JSON.stringify({ error: 'note is required' })
      }
      const existing = await prisma.sM_Customer.findUnique({
        where: { id: resolved.id },
        select: { notes: true },
      })
      const date = new Date().toISOString().slice(0, 10)
      const prefix = existing?.notes ? `${existing.notes}\n` : ''
      const appended = `${prefix}[${date}] ${input.note.trim()}`
      await prisma.sM_Customer.update({
        where: { id: resolved.id },
        data: { notes: appended },
      })
      return JSON.stringify({
        success: true,
        customer: resolved.name,
        newNoteLine: `[${date}] ${input.note.trim()}`,
      })
    }

    case 'add_customer_tag': {
      const resolved = await resolveCustomer(input)
      if (!resolved) {
        return JSON.stringify({
          error: 'Customer not found. Provide email or customerId.',
        })
      }
      const tagName = input.tagName?.trim()
      if (!tagName) {
        return JSON.stringify({ error: 'tagName is required' })
      }
      // Find or create the tag (case-insensitive match on name).
      const existingTag = await prisma.sM_Tag.findFirst({
        where: { name: { equals: tagName, mode: 'insensitive' } },
      })
      const tag =
        existingTag ??
        (await prisma.sM_Tag.create({
          data: {
            name: tagName,
            color:
              BRAND_TAG_COLORS[Math.floor(Math.random() * BRAND_TAG_COLORS.length)],
          },
        }))
      await prisma.sM_CustomerTag.upsert({
        where: { customerId_tagId: { customerId: resolved.id, tagId: tag.id } },
        create: { customerId: resolved.id, tagId: tag.id },
        update: {},
      })
      return JSON.stringify({
        success: true,
        customer: resolved.name,
        tag: tag.name,
        created: !existingTag,
      })
    }

    case 'remove_customer_tag': {
      const resolved = await resolveCustomer(input)
      if (!resolved) {
        return JSON.stringify({
          error: 'Customer not found. Provide email or customerId.',
        })
      }
      const tagName = input.tagName?.trim()
      if (!tagName) return JSON.stringify({ error: 'tagName is required' })
      const tag = await prisma.sM_Tag.findFirst({
        where: { name: { equals: tagName, mode: 'insensitive' } },
      })
      if (!tag) {
        return JSON.stringify({ error: `Tag "${tagName}" does not exist` })
      }
      const deleted = await prisma.sM_CustomerTag.deleteMany({
        where: { customerId: resolved.id, tagId: tag.id },
      })
      return JSON.stringify({
        success: true,
        customer: resolved.name,
        tag: tag.name,
        removed: deleted.count > 0,
      })
    }

    case 'list_tags': {
      const tags = await prisma.sM_Tag.findMany({
        orderBy: { name: 'asc' },
        include: { _count: { select: { customers: true } } },
      })
      return JSON.stringify(
        tags.map((t) => ({
          name: t.name,
          color: t.color,
          customerCount: t._count.customers,
        })),
      )
    }

    default:
      return JSON.stringify({ error: `Unknown tool: ${name}` })
  }
}

// ── Main route ───────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are Melly's AI assistant for her Smelly Melly bath & body product business. You help her manage products, inventory, materials, and recipes through the admin panel.

You are friendly, casual, and helpful. Melly makes handmade bath & body products (lip balm, body scrub, candles, soaps, beard oil, etc.) and sells them through her website.

When Melly asks you to do something:
1. Use the available tools to fulfill her request
2. If you need more info (like price or category), ask before guessing
3. After completing an action, confirm what you did in plain English
4. If she mentions a price like "$4.50", convert to cents (450) for the tools

Important context:
- Products have variants which can be different scents OR different sizes
- If a product has one scent (like "Lavender Dreams Lip Balm"), the scent goes on the product and variants are sizes
- If a product has multiple scents (like "Body Scrub" available in many scents), each variant IS a scent
- Stock/inventory is tracked per variant
- Materials are raw ingredients she buys to make products
- Recipes link materials to products to calculate cost of goods

You can also write product descriptions! If Melly asks you to write a description, or if you just created a product and it has no description, offer to generate one. You can write in different tones:
- "fun" — playful, casual, charming (default)
- "luxe" — upscale, spa-like, indulgent
- "simple" — straightforward, brief

When generating a description, show it to Melly first before saving unless she says to just do it. If she says "write descriptions for all my products" you can batch through them.

You also know Melly's customers — rows are auto-created from orders and deduped by email. Use the CRM tools to help her stay close to her repeat buyers:
- list_customers with segments: "repeat" (2+ orders), "big_spenders" ($100+), "dormant" (no order in 90+ days), "new" (first order within 30 days), "pickup_only", "has_shipped"
- get_customer for a full profile (stats, recent orders, notes, tags)
- customer_segments_summary for a CRM overview
- append_customer_note to log a note (adds a dated line — never overwrites)
- add_customer_tag / remove_customer_tag (creates the tag if missing)
- list_tags to see what's already in use

When answering "who are my top customers?", prefer list_customers with a limit of 5–10 — the results are already sorted by lifetime spend. For "who hasn't ordered lately?" use segment=dormant. Be concise — present customers as a short bulleted list with name, order count, and total spend; don't dump raw JSON.

Do NOT attempt to email customers, run marketing campaigns, or text people — those integrations aren't built yet. If Melly asks, tell her it's coming in a future phase and offer to tag or note the customers instead so she has a list ready.

Keep responses concise and conversational. Don't be overly formal.`

export async function POST(req: NextRequest) {
  if (!(await checkAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return NextResponse.json(
      { error: 'ANTHROPIC_API_KEY not configured. Add it to .env.local.' },
      { status: 500 },
    )
  }

  const body = await req.json()
  const messages: Anthropic.MessageParam[] = body.messages || []

  if (messages.length === 0) {
    return NextResponse.json({ error: 'No messages provided' }, { status: 400 })
  }

  const client = new Anthropic({ apiKey })

  try {
    // Agentic loop: keep going until Claude produces a final text response
    let currentMessages = [...messages]

    for (let i = 0; i < 10; i++) {
      const response = await client.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1024,
        system: SYSTEM_PROMPT,
        tools,
        messages: currentMessages,
      })

      // If stop reason is "end_turn" or no tool use, return the text
      if (response.stop_reason === 'end_turn' || !response.content.some((b) => b.type === 'tool_use')) {
        const textBlocks = response.content.filter((b) => b.type === 'text') as Anthropic.TextBlock[]
        const reply = textBlocks.map((b) => b.text).join('\n')
        return NextResponse.json({
          reply,
          messages: [
            ...currentMessages,
            { role: 'assistant' as const, content: response.content },
          ],
        })
      }

      // Execute tool calls
      const toolResults: Anthropic.ToolResultBlockParam[] = []
      for (const block of response.content) {
        if (block.type === 'tool_use') {
          try {
            const result = await executeTool(block.name, block.input as Record<string, any>, client)
            toolResults.push({
              type: 'tool_result',
              tool_use_id: block.id,
              content: result,
            })
          } catch (e: any) {
            toolResults.push({
              type: 'tool_result',
              tool_use_id: block.id,
              content: JSON.stringify({ error: e.message || 'Tool execution failed' }),
              is_error: true,
            })
          }
        }
      }

      // Add assistant response + tool results and loop
      currentMessages = [
        ...currentMessages,
        { role: 'assistant' as const, content: response.content },
        { role: 'user' as const, content: toolResults },
      ]
    }

    return NextResponse.json({ error: 'Too many tool calls' }, { status: 500 })
  } catch (e: any) {
    console.error('[admin/ai] error:', e)
    return NextResponse.json(
      { error: e.message || 'AI request failed' },
      { status: 500 },
    )
  }
}
