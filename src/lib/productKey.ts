// Klucz produktu — rozpoznawanie, że dwa przepisy używają TEGO SAMEGO produktu.
//
// Mieszkał wcześniej w module zestawu tygodniowego, ale ten zniknął, a klucz jest
// potrzebny w dwóch innych miejscach: na liście zakupów (jedno opakowanie liczone
// raz, koszt dzielony między przepisy) i na stronie przepisu (sekcja „Z tych samych
// produktów"). Stąd osobny plik, którego nazwa mówi, czym jest.

const PL_MAP: Record<string, string> = {
  ą: 'a', ć: 'c', ę: 'e', ł: 'l', ń: 'n', ó: 'o', ś: 's', ź: 'z', ż: 'z',
}

/**
 * Celowo zgrubny: „Twaróg półtłusty 250g" i „twaróg półtłusty" mają trafić w to
 * samo wiadro. Bierzemy dwa pierwsze znaczące słowa przycięte do sześciu znaków,
 * bo polski odmienia końcówki, a gramatura w nazwie nic nie mówi o tożsamości
 * produktu — to nadal ten sam twaróg.
 */
export function productKey(name: string): string {
  return String(name ?? '')
    .toLowerCase()
    .replace(/[ąćęłńóśźż]/g, (c) => PL_MAP[c] ?? c)
    .replace(/\d+\s*(g|kg|ml|l|szt|dag)\b/g, ' ')
    .replace(/[^a-z\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2)
    .slice(0, 2)
    .map((w) => w.slice(0, 6))
    .join('|')
}
