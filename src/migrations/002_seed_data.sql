-- 002: Default seed data (runs only on fresh database)

INSERT OR IGNORE INTO businesses (id, name) VALUES (1, 'Personal');

INSERT OR IGNORE INTO currencies (code, name, symbol, rate) VALUES
  ('USD', 'US Dollar',         '$',  1.0),
  ('EUR', 'Euro',              '€',  0.92),
  ('GBP', 'British Pound',     '£',  0.79),
  ('JPY', 'Japanese Yen',      '¥',  149.5),
  ('CAD', 'Canadian Dollar',   'C$', 1.36),
  ('AUD', 'Australian Dollar', 'A$', 1.53),
  ('CHF', 'Swiss Franc',       'Fr', 0.90),
  ('CNY', 'Chinese Yuan',      '¥',  7.24),
  ('INR', 'Indian Rupee',      '₹',  83.12),
  ('MXN', 'Mexican Peso',      '$',  17.15);

INSERT OR IGNORE INTO settings (key, value) VALUES ('defaultCurrency', 'INR');

INSERT OR IGNORE INTO categories (name, icon, color, type) VALUES
  ('Food & Dining',      'utensils',    '#EF4444', 'debit'),
  ('Transportation',     'car',         '#F59E0B', 'debit'),
  ('Housing & Rent',     'home',        '#8B5CF6', 'debit'),
  ('Utilities',          'zap',         '#06B6D4', 'debit'),
  ('Entertainment',      'film',        '#EC4899', 'debit'),
  ('Healthcare',         'heart',       '#10B981', 'debit'),
  ('Education',          'book-open',   '#3B82F6', 'debit'),
  ('Shopping',           'shopping-cart','#F97316','debit'),
  ('Investments',        'trending-up', '#84CC16', 'debit'),
  ('Miscellaneous',      'package',     '#6366F1', 'debit'),
  ('Salary',             'briefcase',   '#10B981', 'credit'),
  ('Freelance',          'laptop',      '#06B6D4', 'credit'),
  ('Business Income',    'trending-up', '#84CC16', 'credit'),
  ('Rental Income',      'home',        '#8B5CF6', 'credit'),
  ('Investment Returns', 'gift',        '#F59E0B', 'credit'),
  ('Other Income',       'plus-circle', '#6366F1', 'credit');
