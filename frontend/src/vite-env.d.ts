/// <reference types="vite/client" />

declare module 'satellite.js' {
  export function twoline2satrec(line1: string, line2: string): SatRec;
  export function propagate(satrec: SatRec, date: Date): PositionAndVelocity;
  export function gstime(date: Date): number;
  export function eciToGeodetic(positionEci: EciVec3<number>, gmst: number): GeodeticLocation;
  export function eciToEcf(positionEci: EciVec3<number>, gmst: number): EcfVec3<number>;
  export function degreesLat(radians: number): number;
  export function degreesLong(radians: number): number;
  
  export interface SatRec {
    satnum: string;
    no: number;
    [key: string]: any;
  }
  export interface EciVec3<T> { x: T; y: T; z: T; }
  export interface EcfVec3<T> { x: T; y: T; z: T; }
  export interface GeodeticLocation { longitude: number; latitude: number; height: number; }
  export interface PositionAndVelocity {
    position: EciVec3<number> | boolean;
    velocity: EciVec3<number> | boolean;
  }
}
