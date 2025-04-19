const SAMPLE_DATA = [
  { name: 'Weyland-Yutani', targetPercentage: 15, currentTotalValue: 1589.23, currentSharePrice: 102.32 },
  { name: 'Krusty Krab', targetPercentage: 45, currentTotalValue: 5408.84, currentSharePrice: 63.89 },
  { name: 'Majima Construction', targetPercentage: 10, currentTotalValue: 825.52, currentSharePrice: 93.11 },
  { name: 'Speedwagon Foundation', targetPercentage: 30, currentTotalValue: 3013.15, currentSharePrice: 85.66 }
];
const INIT_POPULATION_SIZE = 500;
const INIT_STOP_AFTER_N_GENERATIONS_WITHOUT_BETTER_RESULT = 30;
const INIT_INVESTMENT_LIMIT = 1800;
const MAX_ASSETS = 10;
const PERCENT_SIGN = '%';
const CURRENCY_SIGN = '$';
const DECIMAL_SEPARATOR = '.';
const GROUP_SEPARATOR = ',';
const LAST_EDITABLE_CELL_INDEX = 3;
const STORE_LAST_UNIQUE_SOLUTIONS_COUNT = 5;