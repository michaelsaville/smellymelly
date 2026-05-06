// Curated emoji set for the category icon picker. Hand-picked to cover what a
// soap/skincare/home-goods/print-shop catalog actually needs, plus enough
// breadth to feel like a real picker. Each entry has a `name` (shown on hover)
// and `keywords` used for the typeahead — search terms never see the emoji
// char itself, so users can type "bath" and find "🛁".
export type EmojiEntry = {
  char: string
  name: string
  keywords: string[]
}

export const EMOJI_LIBRARY: { group: string; emoji: EmojiEntry[] }[] = [
  {
    group: 'Bath & Body',
    emoji: [
      { char: '🛁', name: 'Bathtub', keywords: ['bath', 'tub', 'soak', 'body'] },
      { char: '🧼', name: 'Soap', keywords: ['soap', 'wash', 'clean', 'bar'] },
      { char: '🧴', name: 'Lotion bottle', keywords: ['lotion', 'shampoo', 'cream', 'pump'] },
      { char: '🪥', name: 'Toothbrush', keywords: ['toothbrush', 'dental', 'clean'] },
      { char: '🪒', name: 'Razor', keywords: ['razor', 'shave'] },
      { char: '🧽', name: 'Sponge', keywords: ['sponge', 'scrub', 'clean'] },
      { char: '🪞', name: 'Mirror', keywords: ['mirror', 'vanity', 'reflection'] },
      { char: '💆', name: 'Massage', keywords: ['massage', 'spa', 'relax'] },
      { char: '🚿', name: 'Shower', keywords: ['shower', 'wash', 'water'] },
    ],
  },
  {
    group: 'Beauty',
    emoji: [
      { char: '💄', name: 'Lipstick', keywords: ['lipstick', 'lip', 'makeup', 'beauty'] },
      { char: '💋', name: 'Kiss mark', keywords: ['kiss', 'lip', 'smooch', 'lipstick'] },
      { char: '👄', name: 'Mouth', keywords: ['mouth', 'lip', 'kiss'] },
      { char: '💅', name: 'Nail polish', keywords: ['nails', 'polish', 'manicure', 'beauty'] },
      { char: '✨', name: 'Sparkles', keywords: ['sparkle', 'shine', 'glitter', 'magic'] },
      { char: '💎', name: 'Gem', keywords: ['gem', 'diamond', 'jewel', 'precious'] },
      { char: '🧖', name: 'Person in steamy room', keywords: ['spa', 'sauna', 'steam', 'relax'] },
      { char: '🪮', name: 'Hair pick', keywords: ['hair', 'pick', 'comb', 'beard'] },
      { char: '💇', name: 'Haircut', keywords: ['hair', 'cut', 'salon'] },
    ],
  },
  {
    group: 'Candles & Fragrance',
    emoji: [
      { char: '🕯️', name: 'Candle', keywords: ['candle', 'wax', 'wick', 'flame', 'fragrance', 'home'] },
      { char: '🪔', name: 'Diya lamp', keywords: ['lamp', 'oil', 'flame', 'light'] },
      { char: '🔥', name: 'Fire', keywords: ['fire', 'flame', 'hot', 'burn'] },
      { char: '💨', name: 'Wind', keywords: ['wind', 'smoke', 'breeze', 'air'] },
      { char: '🌬️', name: 'Wind face', keywords: ['wind', 'breath', 'breeze'] },
      { char: '🪻', name: 'Hyacinth', keywords: ['flower', 'hyacinth', 'purple', 'fragrance'] },
    ],
  },
  {
    group: 'Plants & Nature',
    emoji: [
      { char: '🌿', name: 'Herb', keywords: ['herb', 'leaf', 'plant', 'natural', 'green'] },
      { char: '🌱', name: 'Seedling', keywords: ['plant', 'seedling', 'grow', 'sprout'] },
      { char: '🍃', name: 'Leaf in wind', keywords: ['leaf', 'wind', 'natural'] },
      { char: '🌾', name: 'Sheaf of rice', keywords: ['wheat', 'grain', 'rice', 'natural'] },
      { char: '🌵', name: 'Cactus', keywords: ['cactus', 'desert', 'plant'] },
      { char: '🌳', name: 'Tree', keywords: ['tree', 'wood', 'natural'] },
      { char: '🌲', name: 'Evergreen', keywords: ['pine', 'evergreen', 'tree', 'forest'] },
      { char: '🪴', name: 'Potted plant', keywords: ['plant', 'pot', 'home'] },
      { char: '🌷', name: 'Tulip', keywords: ['tulip', 'flower'] },
      { char: '🌹', name: 'Rose', keywords: ['rose', 'flower', 'red', 'love'] },
      { char: '🌻', name: 'Sunflower', keywords: ['sunflower', 'flower', 'yellow'] },
      { char: '🌼', name: 'Daisy', keywords: ['daisy', 'flower', 'yellow'] },
      { char: '🌸', name: 'Cherry blossom', keywords: ['blossom', 'flower', 'pink', 'sakura'] },
      { char: '💐', name: 'Bouquet', keywords: ['bouquet', 'flowers', 'gift'] },
      { char: '🪷', name: 'Lotus', keywords: ['lotus', 'flower', 'spa'] },
      { char: '🍀', name: 'Four leaf clover', keywords: ['clover', 'luck', 'irish', 'green'] },
      { char: '☘️', name: 'Shamrock', keywords: ['shamrock', 'irish', 'clover'] },
    ],
  },
  {
    group: 'Food & Kitchen',
    emoji: [
      { char: '🍯', name: 'Honey pot', keywords: ['honey', 'sweet', 'beekeeping'] },
      { char: '🐝', name: 'Bee', keywords: ['bee', 'honey', 'beeswax'] },
      { char: '🥥', name: 'Coconut', keywords: ['coconut', 'tropical'] },
      { char: '🥑', name: 'Avocado', keywords: ['avocado', 'green', 'fruit'] },
      { char: '🍋', name: 'Lemon', keywords: ['lemon', 'citrus', 'yellow'] },
      { char: '🍊', name: 'Orange', keywords: ['orange', 'citrus'] },
      { char: '🍓', name: 'Strawberry', keywords: ['strawberry', 'berry', 'red'] },
      { char: '🫐', name: 'Blueberries', keywords: ['blueberry', 'berry', 'blue'] },
      { char: '🍒', name: 'Cherries', keywords: ['cherry', 'fruit', 'red'] },
      { char: '🍇', name: 'Grapes', keywords: ['grape', 'fruit'] },
      { char: '🥒', name: 'Cucumber', keywords: ['cucumber', 'green', 'spa'] },
      { char: '🌽', name: 'Corn', keywords: ['corn', 'yellow'] },
      { char: '🥄', name: 'Spoon', keywords: ['spoon', 'utensil'] },
      { char: '🥣', name: 'Bowl', keywords: ['bowl', 'mixing'] },
      { char: '🧂', name: 'Salt', keywords: ['salt', 'shaker', 'scrub'] },
      { char: '🧊', name: 'Ice', keywords: ['ice', 'cold', 'cube'] },
      { char: '☕', name: 'Coffee', keywords: ['coffee', 'cup', 'mug'] },
      { char: '🍵', name: 'Tea', keywords: ['tea', 'cup', 'green'] },
      { char: '🍪', name: 'Cookie', keywords: ['cookie', 'baked', 'sweet'] },
      { char: '🍰', name: 'Cake', keywords: ['cake', 'dessert', 'sweet'] },
      { char: '🧁', name: 'Cupcake', keywords: ['cupcake', 'dessert', 'sweet'] },
      { char: '🥧', name: 'Pie', keywords: ['pie', 'dessert', 'baked'] },
      { char: '🍫', name: 'Chocolate', keywords: ['chocolate', 'cocoa', 'sweet'] },
      { char: '🍦', name: 'Ice cream', keywords: ['icecream', 'cone', 'cold'] },
      { char: '🌰', name: 'Chestnut', keywords: ['chestnut', 'nut', 'brown'] },
    ],
  },
  {
    group: 'Symbols',
    emoji: [
      { char: '⭐', name: 'Star', keywords: ['star', 'favorite'] },
      { char: '🌟', name: 'Glowing star', keywords: ['star', 'glow', 'special'] },
      { char: '💫', name: 'Dizzy', keywords: ['dizzy', 'star', 'sparkle'] },
      { char: '☀️', name: 'Sun', keywords: ['sun', 'sunny', 'bright'] },
      { char: '🌙', name: 'Moon', keywords: ['moon', 'night', 'crescent'] },
      { char: '⚡', name: 'Bolt', keywords: ['bolt', 'lightning', 'energy'] },
      { char: '☁️', name: 'Cloud', keywords: ['cloud', 'sky'] },
      { char: '❄️', name: 'Snowflake', keywords: ['snow', 'cold', 'winter'] },
      { char: '🌈', name: 'Rainbow', keywords: ['rainbow', 'color', 'pride'] },
      { char: '💧', name: 'Droplet', keywords: ['drop', 'water', 'liquid'] },
      { char: '💦', name: 'Sweat drops', keywords: ['water', 'splash', 'drops'] },
      { char: '🌊', name: 'Wave', keywords: ['wave', 'ocean', 'water'] },
      { char: '❤️', name: 'Red heart', keywords: ['heart', 'love', 'red'] },
      { char: '🧡', name: 'Orange heart', keywords: ['heart', 'orange'] },
      { char: '💛', name: 'Yellow heart', keywords: ['heart', 'yellow'] },
      { char: '💚', name: 'Green heart', keywords: ['heart', 'green'] },
      { char: '💙', name: 'Blue heart', keywords: ['heart', 'blue'] },
      { char: '💜', name: 'Purple heart', keywords: ['heart', 'purple'] },
      { char: '🤍', name: 'White heart', keywords: ['heart', 'white'] },
      { char: '🤎', name: 'Brown heart', keywords: ['heart', 'brown'] },
      { char: '🖤', name: 'Black heart', keywords: ['heart', 'black'] },
      { char: '🎁', name: 'Gift', keywords: ['gift', 'present', 'wrap'] },
      { char: '🎀', name: 'Ribbon', keywords: ['ribbon', 'bow', 'gift'] },
      { char: '🛍️', name: 'Shopping bag', keywords: ['shopping', 'bag', 'shop'] },
      { char: '🏷️', name: 'Tag', keywords: ['tag', 'label', 'price'] },
    ],
  },
  {
    group: 'Animals',
    emoji: [
      { char: '🐻', name: 'Bear', keywords: ['bear'] },
      { char: '🐰', name: 'Rabbit', keywords: ['rabbit', 'bunny'] },
      { char: '🐱', name: 'Cat', keywords: ['cat', 'kitten'] },
      { char: '🐶', name: 'Dog', keywords: ['dog', 'puppy'] },
      { char: '🦋', name: 'Butterfly', keywords: ['butterfly'] },
      { char: '🐞', name: 'Lady beetle', keywords: ['ladybug', 'bug'] },
      { char: '🐢', name: 'Turtle', keywords: ['turtle'] },
      { char: '🐙', name: 'Octopus', keywords: ['octopus'] },
      { char: '🐠', name: 'Tropical fish', keywords: ['fish', 'tropical'] },
      { char: '🦊', name: 'Fox', keywords: ['fox'] },
      { char: '🦝', name: 'Raccoon', keywords: ['raccoon'] },
      { char: '🦔', name: 'Hedgehog', keywords: ['hedgehog'] },
    ],
  },
  {
    group: 'Misc',
    emoji: [
      { char: '🏠', name: 'House', keywords: ['house', 'home'] },
      { char: '🛏️', name: 'Bed', keywords: ['bed', 'sleep'] },
      { char: '👶', name: 'Baby', keywords: ['baby', 'infant'] },
      { char: '🧒', name: 'Child', keywords: ['child', 'kid'] },
      { char: '👴', name: 'Old man', keywords: ['old', 'man', 'grandpa'] },
      { char: '👵', name: 'Old woman', keywords: ['old', 'woman', 'grandma'] },
      { char: '🧔', name: 'Bearded person', keywords: ['beard', 'man'] },
      { char: '🪒', name: 'Razor', keywords: ['razor', 'shave', 'beard'] },
      { char: '🧶', name: 'Yarn', keywords: ['yarn', 'wool', 'craft'] },
      { char: '🧵', name: 'Thread', keywords: ['thread', 'sewing'] },
      { char: '🪡', name: 'Sewing needle', keywords: ['needle', 'sewing'] },
      { char: '✂️', name: 'Scissors', keywords: ['scissors', 'cut'] },
      { char: '📦', name: 'Package', keywords: ['package', 'box', 'ship'] },
      { char: '🎨', name: 'Palette', keywords: ['palette', 'art', 'paint'] },
      { char: '🖌️', name: 'Paintbrush', keywords: ['brush', 'paint'] },
      { char: '🖍️', name: 'Crayon', keywords: ['crayon', 'color'] },
      { char: '🪅', name: 'Piñata', keywords: ['pinata', 'party'] },
      { char: '🎉', name: 'Party popper', keywords: ['party', 'celebrate'] },
      { char: '🎊', name: 'Confetti ball', keywords: ['party', 'confetti'] },
    ],
  },
]

export const ALL_EMOJI: EmojiEntry[] = EMOJI_LIBRARY.flatMap((g) => g.emoji)

/**
 * Filter the library by a search term. Empty term returns the full ordered
 * list. Match is case-insensitive and runs against name + every keyword.
 */
export function searchEmoji(term: string): EmojiEntry[] {
  const t = term.trim().toLowerCase()
  if (!t) return ALL_EMOJI
  return ALL_EMOJI.filter(
    (e) =>
      e.name.toLowerCase().includes(t) ||
      e.keywords.some((k) => k.toLowerCase().includes(t)),
  )
}
