// Polyfills for JSDOM environment
import { TextEncoder, TextDecoder } from 'util';

global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;
