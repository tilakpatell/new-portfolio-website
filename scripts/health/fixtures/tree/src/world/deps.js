// one file, many forms: each package counts once
import * as THREE from 'three';
import { X } from 'three/examples/jsm/x.js';
import small from './small';
import { readFileSync } from 'node:fs';
// import { gone } from 'lonely';
export * from 'three/addons/y.js';

export const load = () => import('@gltf-transform/core');
export default [THREE, X, small, readFileSync];
