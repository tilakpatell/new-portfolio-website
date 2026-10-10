import { describe, expect, it } from 'vitest';
import { pickEntries, weatherKey } from './bf2017-light.mjs';

// The plan names three of Hoth's five; the spot meter and the death screen are
// stand-ins until the map's own sky[] is read with the keys.
const HOTH = [
  'Levels/Lighting/Hoth/Sunny/VE_Sky_Arctic_Sunny_01',
  'Levels/Lighting/Common/VE_SpotMeter_01',
  'Levels/Lighting/Hoth/Sunset/VE_PV_Hoth_Sunset_01',
  'Levels/Lighting/Common/VE_HighEnd_01',
  'UI/VE_DeathScreen_Desaturate',
];

describe('which VisualEnvironment is the level’s', () => {
  it('takes the VE_Sky_ as the main and the VE_PV_ as overrides', () => {
    expect(pickEntries(HOTH)).toEqual({
      main: 'Levels/Lighting/Hoth/Sunny/VE_Sky_Arctic_Sunny_01',
      overrides: ['Levels/Lighting/Hoth/Sunset/VE_PV_Hoth_Sunset_01'],
    });
  });

  it('gives no main when the list has no sky', () => {
    expect(pickEntries(['VE_HighEnd_01'])).toEqual({ main: null, overrides: [] });
    expect(pickEntries(undefined)).toEqual({ main: null, overrides: [] });
  });

  it('keys a weather by its folder, lower case', () => {
    expect(weatherKey('Levels/Lighting/Hoth/Sunny/VE_Sky_Arctic_Sunny_01')).toBe('sunny');
    expect(weatherKey('Levels/Lighting/Hoth/Blizzard/VE_PV_Hoth_Blizzard_01')).toBe('blizzard');
    expect(weatherKey('VE_Sky_Loose')).toBeNull();
  });
});
