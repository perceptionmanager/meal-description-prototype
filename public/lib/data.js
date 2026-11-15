// Sample data. Every meal and wine here is fictional. The shape (a short ingredient line per dish,
// a small wine list with tasting notes, one dessert wine) follows how an airline menu is laid out.

// Two service slots. The main course can be paired with a wine; the second meal never is.
export const SLOTS = [
  { id: 'main', label: 'Main course', pairing: true },
  { id: 'second', label: 'Second meal', pairing: false },
];

// Fictional people for the review roles. Nobody here is a real user.
export const PEOPLE = { reviewer: 'Jordan Ellis', owner: 'Priya Raman' };

export const MEALS = [
  {
    id: 'short-rib',
    slot: 'main',
    name: 'Braised Beef Short Rib',
    course: 'Main course',
    ingredients: ['beef short rib', 'smoky pepper sauce', 'creamy polenta', 'haricots verts', 'piquillo peppers'],
  },
  {
    id: 'chicken',
    slot: 'main',
    name: 'Roasted Chicken Breast',
    course: 'Main course',
    ingredients: ['chicken breast', 'tarragon jus', 'celeriac and potato purée', 'asparagus', 'wilted spinach'],
  },
  {
    id: 'risotto',
    slot: 'main',
    name: 'Wild Mushroom Risotto',
    course: 'Main course',
    ingredients: ['arborio rice', 'wild mushrooms', 'roasted red onion', 'balsamic vinegar', 'chives', 'parmesan'],
  },
  {
    id: 'salmon',
    slot: 'main',
    name: 'Seared Salmon',
    course: 'Main course',
    ingredients: ['salmon fillet', 'lemon butter sauce', 'new potatoes', 'green beans', 'dill'],
  },
  {
    id: 'sandwich',
    slot: 'second',
    name: 'Smoked Turkey Sandwich',
    course: 'Light meal',
    ingredients: ['smoked turkey', 'aged cheddar', 'sourdough bread', 'tomato', 'crisp lettuce'],
  },
  {
    id: 'pasta-salad',
    slot: 'second',
    name: 'Garden Pasta Salad',
    course: 'Light meal',
    ingredients: ['fusilli pasta', 'cherry tomatoes', 'cucumber', 'basil', 'olive oil dressing'],
  },
  {
    id: 'cheese-plate',
    slot: 'second',
    name: 'Fruit and Cheese Plate',
    course: 'Light meal',
    ingredients: ['sliced apple', 'cheddar', 'red grapes', 'toasted almonds', 'water crackers'],
  },
  {
    id: 'tart',
    slot: 'second',
    name: 'Chocolate Tart',
    course: 'Dessert',
    ingredients: ['dark chocolate', 'sea salt', 'whipped cream', 'raspberries'],
  },
];

export const WINES = [
  {
    id: 'brut',
    name: 'Harbor Ridge Brut',
    style: 'Sparkling',
    notes: 'Green apple, lemon zest and toasted brioche. Crisp and dry, with fine bubbles.',
  },
  {
    id: 'chard',
    name: 'Alder Creek Chardonnay',
    style: 'White',
    notes: 'Ripe pear and vanilla with light oak. Medium-bodied and creamy, with moderate acidity.',
  },
  {
    id: 'pinot',
    name: 'Stonebridge Pinot Noir',
    style: 'Red',
    notes: 'Red cherry, forest floor and soft spice. Light to medium body with gentle tannins.',
  },
  {
    id: 'cab',
    name: 'Copper Hollow Cabernet Sauvignon',
    style: 'Red',
    notes: 'Blackcurrant, cedar and dark chocolate. Full-bodied with firm tannins.',
  },
  {
    id: 'port',
    name: 'Maple Cask 10-Year Tawny Port',
    style: 'Dessert',
    notes: 'Brown sugar, roasted nuts and toffee. Sweet and full-bodied, aged in cask.',
  },
];

export const LIMITS = {
  nameMax: 60,
  ingredientsMax: 12,
  ingredientMax: 60,
  descriptionMax: 400,
  descriptionWords: [15, 45],
  reasonWords: 22,
};
