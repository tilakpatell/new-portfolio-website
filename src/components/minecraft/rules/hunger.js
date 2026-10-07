// Minecraft, hunger, as the game's FoodStats (1.12, normal difficulty).
// Doing things tires the player (exhaustion): a metre sprinted 0.1, swum
// 0.01, a jump 0.05 (0.2 sprinting), a block broken 0.005, a blow struck or
// taken 0.1, a heart healed 6. Each 4 of it costs a point of saturation, or
// of hunger once saturation is gone. Full (20) with saturation left, the
// body heals fast, saturation's worth (up to 6, a heart a sixth) every 10
// ticks; at 18 or more a point every 80 ticks; at 0 starving takes a point
// every 80 ticks down to 1. Eating takes 32 ticks of holding use and gives
// the food's hunger and saturation (saturation never above hunger).

export const MAX_HUNGER = 20;
export const EAT_TICKS = 32;
export const EXHAUST = { sprint: 0.1, swim: 0.01, jump: 0.05, sprintJump: 0.2, dig: 0.005, attack: 0.1, hurt: 0.1, heal: 6 };

export function exhaust(p, amount) {
  p.exhaustion = Math.min(p.exhaustion + amount, 40);
}

function heal(p, n) {
  p.health = Math.min(20, p.health + n);
}

// One tick of the stomach. Pushes a hurt event when starving.
export function stepHunger(p, events) {
  if (p.exhaustion > 4) {
    p.exhaustion -= 4;
    if (p.saturation > 0) p.saturation = Math.max(p.saturation - 1, 0);
    else p.hunger = Math.max(p.hunger - 1, 0);
  }
  const hurt = p.health < 20;
  if (p.hunger >= MAX_HUNGER && p.saturation > 0 && hurt) {
    if (++p.foodTimer >= 10) {
      const f = Math.min(p.saturation, 6);
      heal(p, f / 6);
      exhaust(p, f);
      p.foodTimer = 0;
    }
  } else if (p.hunger >= 18 && hurt) {
    if (++p.foodTimer >= 80) {
      heal(p, 1);
      exhaust(p, EXHAUST.heal);
      p.foodTimer = 0;
    }
  } else if (p.hunger <= 0) {
    if (++p.foodTimer >= 80) {
      if (p.health > 1) {
        p.health -= 1;
        exhaust(p, EXHAUST.hurt);
        events.push({ type: 'hurt', amount: 1, cause: 'starve' });
      }
      p.foodTimer = 0;
    }
  } else p.foodTimer = 0;
}

export function eat(p, food) {
  p.hunger = Math.min(p.hunger + food.hunger, MAX_HUNGER);
  p.saturation = Math.min(p.saturation + food.saturation, p.hunger);
}
