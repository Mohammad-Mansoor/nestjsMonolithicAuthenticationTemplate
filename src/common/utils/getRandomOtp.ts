

export const generateOtp = (length = 6) => {
    const chars = '0123456789';
    const array = new Uint32Array(length);
    crypto.getRandomValues(array);
  
    return Array.from(array, x => chars[x % chars.length]).join('');
  }