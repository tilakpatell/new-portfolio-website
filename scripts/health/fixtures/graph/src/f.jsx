// two imports on one line, the second a stylesheet imported for its side
// effects; no extension: ./g is g.jsx
import G from './g'; import './f.css';

export default function F() {
  return <G />;
}
