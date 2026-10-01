// random utils...

import axios from 'axios';

// a simple convenience wrapper
export const api = axios.create({ withCredentials: true });
