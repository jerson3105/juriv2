import { AVATAR_LEVEL_FACTOR, niceRound, type AvatarPriceLevel } from '../services/avatarCatalog.service.js';

// Reglas de los sobres de figuritas (Coleccionables v2). Precio en semanas de oro de la clase, como el avatar.

/** Una de cada cinco figuritas del sobre, en promedio, es repetida (de las que ya tenías). En inicial a 2.º, ninguna. */
export const DUPLICATE_CHANCE = 0.2;
/** Un sobre de 5 cuesta media semana de oro de la clase… */
const PACK_WEEKS = 0.5;
const BASE_PACK_CARDS = 5;
/** …y completar un álbum, contando las repetidas, nunca pasa de 3 semanas (en álbumes grandes el sobre baja). */
const MAX_COMPLETE_WEEKS = 3;
/** Una figurita es «Nueva» sus primeros 7 días. */
export const NEW_CARD_DAYS = 7;
/** Caja de la clase: cada alumno toma hasta 3 figuritas al día (donar no tiene límite). */
export const BOX_TAKES_PER_DAY = 3;

/**
 * Copias que puede donar a la caja: las normales que le sobran. Nunca la última copia ni una brillante (con una
 * brillante, todas sus normales son repetidas).
 */
export const donatableCopies = (copy: { normal: number; shiny: boolean } | undefined) =>
  copy ? Math.max(0, copy.normal - (copy.shiny ? 0 : 1)) : 0;

/** La caja está abierta en los álbumes activos con la caja encendida; no en inicial a 2.º (sus sobres no dan repetidas). */
export const boxOpenFor = (album: { isActive: boolean; allowTrades: boolean }, young: boolean) =>
  album.isActive && album.allowTrades && !young;

/** Sobre de 5 y hasta 2 al día; en inicial a 2.º, sobre de 3, uno al día y sin repetidas. */
export const packRules = (young: boolean) => ({
  packCards: young ? 3 : BASE_PACK_CARDS,
  dailyPacks: young ? 1 : 2,
  duplicateChance: young ? 0 : DUPLICATE_CHANCE,
});

/** El sobre de bienvenida: 5 figuritas (3 en álbumes de menos de 15 y en inicial a 2.º), nunca más de las que faltan. */
export const welcomeCards = (young: boolean, totalCards: number, missing: number) =>
  Math.max(0, Math.min(missing, young || totalCards < 15 ? 3 : 5));

/**
 * Precios del álbum con el oro semanal de la clase (`weekly`) y su nivel (½, 1 o 2). El último sobre trae solo lo
 * que falta y cuesta su parte: `priceFor(cartas)`. `completeCost` es lo que cuesta completarlo, en promedio, después
 * del sobre de bienvenida.
 */
export const albumPricing = (weekly: number, level: AvatarPriceLevel, totalCards: number, young: boolean) => {
  const rules = packRules(young);
  const newShare = 1 - rules.duplicateChance;
  const perCard = Math.min(
    (PACK_WEEKS * weekly) / BASE_PACK_CARDS,
    (MAX_COMPLETE_WEEKS * weekly) / Math.max(1, totalCards / newShare),
  ) * AVATAR_LEVEL_FACTOR[level];
  const priceFor = (cards: number) => niceRound(perCard * cards);
  const packPrice = priceFor(rules.packCards);
  const paidDraws = Math.max(0, totalCards - welcomeCards(young, totalCards, totalCards)) / newShare;
  const completeCost = Math.round((paidDraws / rules.packCards) * packPrice);
  return { ...rules, packPrice, priceFor, completeCost, completeWeeks: weekly > 0 ? completeCost / weekly : 0 };
};

/**
 * Sortea un sobre de `count` figuritas. Cada una es repetida con probabilidad `duplicateChance` (una de las que tenía
 * antes del sobre) y si no, una de las que le faltan, todas igual de probables. Dentro del sobre no se repite ninguna.
 */
export const drawPack = <T>(missing: T[], ownedBefore: T[], count: number, duplicateChance: number, random: () => number = Math.random) => {
  const fresh = [...missing];
  const repeated = [...ownedBefore];
  const picked: Array<{ card: T; isNew: boolean }> = [];
  for (let index = 0; index < count; index++) {
    const duplicate = repeated.length > 0 && (fresh.length === 0 || random() < duplicateChance);
    const pool = duplicate ? repeated : fresh;
    if (pool.length === 0) break;
    const [card] = pool.splice(Math.floor(random() * pool.length), 1);
    picked.push({ card, isNew: !duplicate });
  }
  return picked;
};
