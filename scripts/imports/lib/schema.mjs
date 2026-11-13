// Small, dependency-free JSON Schema validator for the imports public feed.
//
// It supports the keywords the schema actually uses: $ref (local #/$defs),
// type (including a union with "null"), required, properties,
// additionalProperties:false, items, enum, const, pattern, minLength,
// minItems/maxItems, minimum/maximum and format date/date-time. It rejects
// unknown keywords? No: unknown keywords are ignored, as JSON Schema allows.
//
// The important property for this project is additionalProperties:false at
// every object level, so a supplier/private field cannot slip into the feed.

function typeOf(value) {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  if (typeof value === 'number') return Number.isInteger(value) ? 'integer' : 'number';
  return typeof value;
}

function matchesType(value, t) {
  const actual = typeOf(value);
  if (t === 'number') return actual === 'number' || actual === 'integer';
  if (t === 'integer') return actual === 'integer';
  return actual === t;
}

function resolveRef(root, ref) {
  if (!ref.startsWith('#/')) throw new Error(`unsupported $ref: ${ref}`);
  let cur = root;
  for (const part of ref.slice(2).split('/')) {
    const key = part.replace(/~1/g, '/').replace(/~0/g, '~');
    cur = cur?.[key];
    if (cur === undefined) throw new Error(`unresolved $ref: ${ref}`);
  }
  return cur;
}

export function validate(value, schema, root = schema) {
  const errors = [];
  const add = (path, message) => errors.push({ path, message });

  const walk = (v, s, path) => {
    if (!s || typeof s !== 'object') return;
    if (s.$ref) {
      walk(v, resolveRef(root, s.$ref), path);
      return;
    }

    if (s.type !== undefined) {
      const types = Array.isArray(s.type) ? s.type : [s.type];
      if (!types.some((t) => matchesType(v, t))) {
        add(path, `expected ${types.join('|')}, got ${typeOf(v)}`);
        return;
      }
    }

    if (Object.prototype.hasOwnProperty.call(s, 'const') && v !== s.const) add(path, `expected const ${JSON.stringify(s.const)}`);
    if (Array.isArray(s.enum) && !s.enum.some((x) => Object.is(x, v))) add(path, `expected one of ${JSON.stringify(s.enum)}`);

    if (typeof v === 'string') {
      if (s.minLength != null && v.length < s.minLength) add(path, `shorter than ${s.minLength}`);
      if (s.pattern && !new RegExp(s.pattern).test(v)) add(path, `does not match ${s.pattern}`);
      if (s.format === 'date-time' && Number.isNaN(Date.parse(v))) add(path, 'not a date-time');
      if (s.format === 'date') {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(v) || Number.isNaN(Date.parse(`${v}T00:00:00Z`))) add(path, 'not a date');
      }
    }

    if (typeof v === 'number') {
      if (s.minimum != null && v < s.minimum) add(path, `less than ${s.minimum}`);
      if (s.maximum != null && v > s.maximum) add(path, `greater than ${s.maximum}`);
    }

    if (Array.isArray(v)) {
      if (s.minItems != null && v.length < s.minItems) add(path, `fewer than ${s.minItems} items`);
      if (s.maxItems != null && v.length > s.maxItems) add(path, `more than ${s.maxItems} items`);
      if (s.items) v.forEach((item, i) => walk(item, s.items, `${path}[${i}]`));
    }

    if (v && typeof v === 'object' && !Array.isArray(v)) {
      for (const key of s.required || []) if (!(key in v)) add(path, `missing required ${key}`);
      const props = s.properties || {};
      for (const [key, val] of Object.entries(v)) {
        if (Object.prototype.hasOwnProperty.call(props, key)) {
          walk(val, props[key], `${path}.${key}`);
        } else if (s.additionalProperties === false) {
          add(`${path}.${key}`, 'additional property is not allowed');
        } else if (s.additionalProperties && typeof s.additionalProperties === 'object') {
          walk(val, s.additionalProperties, `${path}.${key}`);
        }
      }
    }
  };

  walk(value, schema, '$');
  return { valid: errors.length === 0, errors };
}

export function assertValid(value, schema, label = 'value') {
  const r = validate(value, schema);
  if (!r.valid) {
    const first = r.errors.slice(0, 5).map((e) => `${e.path}: ${e.message}`).join('; ');
    throw new Error(`${label} does not match the schema: ${first}`);
  }
  return value;
}
