# Sommetjes

Een eenvoudige rekenapp voor kinderen van 4 tot 6 jaar. Werkt op een oude iPad 2 (iOS 9) als web-app op het beginscherm.

## Wat kun je oefenen?

1. **Tellen** — tel 1 tot 10 plaatjes en tik het goede getal
2. **Plus 5** — optellen tot 5 met plaatjes
3. **Plus 10** — optellen tot 10 met plaatjes
4. **Min** — aftrekken met doorgestreepte plaatjes (eerst tot 5, later tot 10)
5. **Tafels** — de tafels van 1 tot 10, of alle tafels door elkaar
6. **Letters** — letter zoeken, begint met, overtrekken, en de namen van Jasper, Laurens en Mirthe

Elke vraag heeft drie grote antwoordknoppen. Bij een goed antwoord krijg je een ster. Na vijf goede antwoorden volgt een klein feestje. Een fout antwoord is niet erg: je mag het gewoon nog eens proberen.

## Op de iPad zetten (aanbevolen: hetzelfde wifinetwerk)

De betrouwbaarste manier voor een iPad 2 is de app vanaf een computer in huis aan te bieden, zónder internet en zónder account.

1. Zet de iPad en de computer op hetzelfde wifinetwerk.
2. Open op de computer de map `rekenapp`.
3. Start een klein webadres, bijvoorbeeld in Terminal / opdrachtprompt:

   ```bash
   python3 -m http.server 8000
   ```

   Of op Windows, in die map: `python -m http.server 8000`
4. Zoek het lokale IP-adres van de computer (bijvoorbeeld `192.168.1.23`).
5. Open op de iPad Safari en ga naar `http://192.168.1.23:8000`
6. Tik op **Delen** (vierkantje met pijl) en kies **Zet op beginscherm**.
7. Daarna open je de app via het nieuwe icoon. Hij vult het hele scherm.

Laat de computer aan staan zolang je de app de eerste keer opent. Als de pagina eenmaal geladen is, blijft hij in het geheugen van Safari zolang die niet wordt gewist. Voor gewoon dagelijks gebruik is het handig de computer-server even aan te zetten als de iPad de pagina opnieuw moet laden.

## Openbaar internet

Veel gratis websites gebruiken een Let's Encrypt-certificaat. iOS 9 vertrouwt dat standaard niet (pas vanaf iOS 10). Een https-link van GitHub Pages, Netlify, Surge of tiiny.host kan op de iPad 2 dus een certificaatfout geven, ook als de site op een moderne telefoon wel werkt.

Daarom is het lokale adres (`http://192.168.x.x:8000`) de veiligste keuze. Er is geen account voor nodig.
