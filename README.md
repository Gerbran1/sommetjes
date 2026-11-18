# Sommetjes

Een eenvoudige oefenapp voor kinderen van 4 tot 6 jaar, met getallen, letters en puzzels. Werkt op een oude iPad 2 (iOS 9) als web-app op het beginscherm.

## Wat kun je oefenen?

Op het startscherm kies je **Getallen**, **Letters** of **Puzzels**.

**Getallen**
1. **Tellen** — tel 1 tot 10 plaatjes en tik het goede getal
2. **Plus 5** — optellen tot 5 met plaatjes
3. **Plus 10** — optellen tot 10 met plaatjes
4. **Min** — aftrekken met doorgestreepte plaatjes (eerst tot 5, later tot 10)
5. **Tafels** — de tafels van 1 tot 10, of alle tafels door elkaar

**Letters**
6. **Letter zoeken**, **Begint met**, **Overtrekken** (eerst 8 kernletters, of alle 26 letters), en **Mijn naam** (Jasper, Laurens en Mirthe). Elk heeft een Nederlands woord dat echt met die letter begint (bij i: iglo, niet ijs).

**Puzzels**
7. **Schuifpuzzel** — een plaatje in 4 (2×2) of 9 (3×3) stukken; tik op twee stukjes om ze te wisselen. Er is een vaag voorbeeldplaatje zichtbaar.
8. **Vormen passen** — sleep cirkel, vierkant, driehoek en andere vormen in het juiste gaatje (later ook gedraaid).
9. **Spiegelen** — tik de lege vakjes aan om de andere helft van het figuur hetzelfde te maken.
10. **Natekenen** — kijk naar het figuur op de stippen en teken de lijnen na op het lege raster.
11. **Tangram** — sleep 3 of 4 grote stukken in de silhouet (huis, boot, boom). Later kun je tikken om te draaien.

Bij de getallen- en letterspellen heeft elke vraag drie grote antwoordknoppen. Bij een goed antwoord of een voltooide puzzel krijg je een ster. Na vijf sterren volgt een klein feestje. Een fout antwoord is niet erg: je mag het gewoon nog eens proberen.


De app praat met opgenomen stemmen van Colette en Maarten (nederlands). Ze wisselen elkaar per vraag af; de aanmoediging na een antwoord komt van dezelfde stem als de vraag. Op het startscherm kies je wie er speelt: Jasper, Laurens of Mirthe. Die keuze wordt onthouden, en het spel **Mijn naam** start dan met die speler. Af en toe hoor je een persoonlijke aanmoediging, zoals "Goed zo, Jasper!".


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
