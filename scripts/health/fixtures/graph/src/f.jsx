// a stylesheet imported for its side effects; no extension: ./g is g.jsx
import './f.css';
import G from './g';

export default function F() {
  return <G />;
}
