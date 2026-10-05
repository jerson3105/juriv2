/**
 * Nombres de personas (Perú) para armar el padrón desde las clases: comparar cómo figura un mismo estudiante en
 * distintas clases y proponer la división Apellidos ┃ Nombres. La propuesta se corrige a mano en la consola.
 */

/** Partículas de los apellidos («de la Cruz»): no cuentan para comparar y van pegadas a la palabra siguiente. */
const PARTICLES = new Set(['de', 'del', 'la', 'las', 'los', 'y', 'da', 'van', 'von', 'di']);

// Nombres de pila frecuentes (sin tildes, en minúsculas): deciden si un nombre sin coma empieza por el nombre o por
// los apellidos. No hace falta que esté completa: sin pistas se asume «Nombres Apellidos».
const GIVEN_NAMES = new Set(`
aaron abel abigail abraham adan adolfo adrian adriana agustin aida alan alba alberto alejandra alejandro alessandra
alessandro alex alexander alexandra alexis alfredo alicia alison alma alonso amanda amelia ana anahi andre andrea
andres angel angela angelica angelo angie anibal antonella antonio anthony araceli ariana ariel armando arturo astrid
aurora axel barbara beatriz belen benjamin bernardo blanca brandon brayan brenda briana brigitte bruno camila camilo
candy carla carlos carmen carolina catalina cecilia cesar christian cielo claudia clara cristian cristina cristopher
dafne dana daniel daniela danna dante dario david dayana deyanira diana diego dilan dina dulce dylan edgar edison
eduardo edwin efrain elena elias elizabeth elmer elsa elvis emanuel emilia emiliano emily emma emmanuel enrique erick
ernesto esmeralda esperanza estefany esteban esther eva evelyn ezequiel fabian fabiola fabricio fatima federico felipe
fernanda fernando flavia flavio flor francisco franco frank franklin freddy gabriel gabriela gael genesis gerardo
german gianella gianfranco gilberto gisela giuliana gloria gonzalo graciela guadalupe guillermo gustavo hanna hector
heidi henry hernan hilda hugo ian ignacio ingrid irene iris isaac isabel isabella isaias ismael itzel ivan ivanna jack
jade jaime jair james jasmin javier jazmin jean jefferson jenifer jeremy jesus jhon jhonatan jhordan jimena joaquin
joel johan john jonathan jordan jorge jose josefina josue juan juana julia julian juliana julio junior karen karina
katherine kathia kelly kendra kevin kiara kimberly laura leandro leonardo leslie lia liam lidia liliana lionel lizbeth
lorena lourdes luana lucas lucero lucia luciana luciano luis luisa luna luz maia maite manuel marco marcos margarita
maria mariana maribel mariela marina mario maritza marlene martha martin mateo matias mauricio maximo mayra melanie
melany melissa mercedes mia micaela miguel milagros milena miriam moises monica nahomi naomi natalia nataly nayeli
nelly nestor nicolas nicole noah noelia noemi norma octavio olga omar oscar pablo paola patricia paul paula pedro
percy piero pilar priscila rafael rafaela ramiro raquel raul rebeca renata renato renzo ricardo roberto rocio rodolfo
rodrigo rolando romina rosa rosario ruben rut ruth samuel sandra santiago sara sarita saul scarlett sebastian sergio
shirley silvia sofia sonia stefany susana tatiana teo teresa thais thiago tomas ursula valentin valentina valentino
valeria vanessa vania veronica vicente victor victoria violeta walter wendy wilmer william ximena yamile yasmin yerson
yesenia yolanda yuliana zaid zarela zoe
`.trim().split(/\s+/));

/** Una palabra para comparar: sin tildes, minúsculas, solo letras. */
export const normalizeWord = (word: string) => word.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^a-z]/g, '');

/** Palabras de un nombre tal como se escribieron (sin comas ni puntos sueltos). */
const displayWords = (raw: string) => raw.replace(/[,;]/g, ' ').split(/\s+/).map((w) => w.replace(/^[.'´`-]+|[.'´`-]+$/g, '')).filter(Boolean);

/** Las palabras que cuentan para comparar dos nombres: sin partículas ni iniciales sueltas. */
export const matchWords = (raw: string): string[] =>
  displayWords(raw).map(normalizeWord).filter((w) => w.length > 1 && !PARTICLES.has(w));

/** «QUISPE» → «Quispe»; las partículas en minúscula salvo al inicio («de la Cruz»). */
const capitalize = (word: string, first: boolean) => {
  const lower = word.toLocaleLowerCase('es');
  if (!first && PARTICLES.has(normalizeWord(word))) return lower;
  return lower.replace(/(^|[-'])(\p{L})/gu, (_, sep: string, letter: string) => sep + letter.toLocaleUpperCase('es'));
};

/** Cada palabra con su mayúscula, salvo que ya venga en mayúsculas y minúsculas mezcladas (se respeta). */
const tidy = (words: string[]) => words.map((w, i) => (w === w.toUpperCase() || w === w.toLowerCase() ? capitalize(w, i === 0) : w));

/** «QUISPE DE LA CRUZ» → «Quispe de la Cruz» (para nombres que llegan de un Excel). */
export const tidyName = (raw: string) => tidy(displayWords(raw)).join(' ');

/** Une partículas con la palabra siguiente para no cortar «de | la Cruz». Devuelve grupos de palabras. */
const chunk = (words: string[]) => {
  const chunks: string[][] = [];
  let pending: string[] = [];
  for (const word of words) {
    pending.push(word);
    if (!PARTICLES.has(normalizeWord(word))) {
      chunks.push(pending);
      pending = [];
    }
  }
  if (pending.length) chunks.push(pending);
  return chunks;
};

export interface NameSplit {
  lastNames: string[];
  firstNames: string[];
}

/**
 * Propone Apellidos ┃ Nombres. Con coma, es «Apellidos, Nombres». Sin coma, el orden se deduce por los nombres de pila
 * frecuentes al inicio o al final; sin pistas, «Nombres Apellidos» (1+1, 1+2, 2+2, 2+resto).
 */
export const splitPersonName = (raw: string): NameSplit => {
  const comma = raw.indexOf(',');
  if (comma > 0) {
    const last = tidy(displayWords(raw.slice(0, comma)));
    const first = tidy(displayWords(raw.slice(comma + 1)));
    if (last.length && first.length) return { lastNames: last, firstNames: first };
  }
  const words = tidy(displayWords(raw));
  if (words.length <= 1) return { lastNames: [], firstNames: words };
  const chunks = chunk(words);
  const isGiven = (c: string[]) => c.length === 1 && GIVEN_NAMES.has(normalizeWord(c[0]));
  const n = chunks.length;
  const leading = (() => { let k = 0; while (k < n - 1 && isGiven(chunks[k])) k++; return k; })();
  const trailing = (() => { let k = 0; while (k < n - 1 && isGiven(chunks[n - 1 - k])) k++; return k; })();
  const flat = (cs: string[][]) => cs.flat();

  if (trailing > 0 && leading === 0) {
    // «Quispe Mamani Juan Carlos»: apellidos primero.
    const k = Math.min(trailing, 2);
    return { lastNames: flat(chunks.slice(0, n - k)), firstNames: flat(chunks.slice(n - k)) };
  }
  if (leading > 0 && trailing === 0) {
    const k = Math.min(leading, 2, n - 1);
    return { lastNames: flat(chunks.slice(k)), firstNames: flat(chunks.slice(0, k)) };
  }
  // Sin pistas (o pistas a ambos lados): «Nombres Apellidos».
  const k = n === 2 ? 1 : n === 3 ? 1 : 2;
  return { lastNames: flat(chunks.slice(k)), firstNames: flat(chunks.slice(0, k)) };
};

/** Distancia de edición limitada a 1 (para «Chavez» / «Chaves»). */
const withinOneEdit = (a: string, b: string) => {
  if (a === b) return true;
  if (Math.abs(a.length - b.length) > 1) return false;
  let i = 0;
  let j = 0;
  let edits = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) { i++; j++; continue; }
    if (++edits > 1) return false;
    if (a.length > b.length) i++;
    else if (b.length > a.length) j++;
    else { i++; j++; }
  }
  return edits + (a.length - i) + (b.length - j) <= 1;
};

/** ¿Dos palabras son la misma? Exactas, o a una letra si ambas tienen 5 o más. */
export const sameWord = (a: string, b: string, fuzzy: boolean) => a === b || (fuzzy && a.length >= 5 && b.length >= 5 && withinOneEdit(a, b));

/** ¿Todas las palabras de `small` están en `big`? (cada una se usa una sola vez) */
export const containsWords = (small: string[], big: string[], fuzzy: boolean) => {
  const pool = [...big];
  return small.every((word) => {
    const at = pool.findIndex((candidate) => sameWord(word, candidate, fuzzy));
    if (at < 0) return false;
    pool.splice(at, 1);
    return true;
  });
};
