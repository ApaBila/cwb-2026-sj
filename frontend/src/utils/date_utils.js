const MS_PER_DAY = 24 * 60 * 60 * 1000;

function parse(d) {
  if (!d) return null;
  if (d instanceof Date) return new Date(d);
  // accept YYYY-MM-DD or ISO
  return new Date(d + 'T00:00:00');
}

function add(date, amount, scale) {
  const d = new Date(date);
  switch (scale) {
    case 'day':
    case 'days':
      d.setDate(d.getDate() + amount);
      return d;
    case 'week':
    case 'weeks':
      d.setDate(d.getDate() + amount * 7);
      return d;
    case 'month':
    case 'months':
      d.setMonth(d.getMonth() + amount);
      return d;
    case 'year':
    case 'years':
      d.setFullYear(d.getFullYear() + amount);
      return d;
    default:
      d.setDate(d.getDate() + amount);
      return d;
  }
}

function diff(a, b, unit = 'day') {
  const da = new Date(a);
  const db = new Date(b);
  const ms = da - db;
  if (unit === 'day') return Math.floor(ms / MS_PER_DAY);
  if (unit === 'month') return (da.getFullYear() - db.getFullYear()) * 12 + (da.getMonth() - db.getMonth());
  if (unit === 'year') return da.getFullYear() - db.getFullYear();
  return Math.floor(ms / MS_PER_DAY);
}

function format(date, fmt = 'YYYY-MM-DD') {
  if (!date) return '';
  const d = new Date(date);
  const y = d.getFullYear();
  const yy = String(y).slice(-2);
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  
  if (fmt === 'YYYY-MM-DD') return `${y}-${m}-${day}`;
  if (fmt === 'MM/DD') return `${m}/${day}`;
  if (fmt === 'YY/MM') return `${yy}/${m}`;
  if (fmt === 'MM-DD') return `${m}-${day}`;
  if (fmt === 'MMM DD') {
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${monthNames[d.getMonth()]} ${d.getDate()}`;
  }
  if (fmt === 'MMM D') {
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${monthNames[d.getMonth()]} ${d.getDate()}`;
  }
  if (fmt === 'MMM YYYY') {
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${monthNames[d.getMonth()]} ${y}`;
  }
  return `${y}-${m}-${day}`;
}

function start_of(date, unit = 'day') {
  const d = new Date(date);
  if (unit === 'day') {
    d.setHours(0,0,0,0);
    return d;
  }
  if (unit === 'month') {
    d.setDate(1);
    d.setHours(0,0,0,0);
    return d;
  }
  if (unit === 'year') {
    d.setMonth(0);
    d.setDate(1);
    d.setHours(0,0,0,0);
    return d;
  }
  return d;
}

function get_days_in_month(date) {
  const d = new Date(date);
  return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
}

export default { parse, add, diff, format, start_of, get_days_in_month };
