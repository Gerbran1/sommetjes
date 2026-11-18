# Leer & Speel

Een eenvoudige oefenapp voor kinderen van 4 tot 6 jaar, met getallen, letters, puzzels en geheugenspellen. Werkt op een oude iPad 2 (iOS 9) als web-app op het beginscherm.

## Wat kun je oefenen?

Op het startscherm kies je **Getallen**, **Letters**, **Puzzels**, **Geheugen** of **Tekenen**.

**Getallen**
1. **Tellen** — tel 1 tot 10 plaatjes en tik het goede getal
2. **Plus 5** — optellen tot 5 met plaatjes
3. **Plus 10** — optellen tot 10 met plaatjes
4. **Plus tot 30** — grotere sommen zoals 11+8 of 19+6, met tientallen als staven van 10 en losse stippen
5. **Min** — aftrekken met doorgestreepte plaatjes (eerst tot 5, later tot 10)
6. **Min tot 30** — grotere aftreksommen zoals 21−5 of 15−8, over het tiental, met tientallenstaven en doorgestreepte stippen
7. **Tafels** — de tafels van 1 tot 10, of alle tafels door elkaar
8. **Getallenlijn** — sleep een lijn van vier getalkaarten naar de juiste plek op de lijn (tot 10, tot 20 of tot 100). Bij 100 mag je er ongeveer 2 naast zitten. Een goed getal kleurt groen en je hoort "Ja, 34!".

**Letters**
7. **Letter zoeken**, **Begint met**, **Tekenen** (eerst 8 kernletters, of alle 26 letters), **Klinkers** en **Mijn naam** (Jasper, Laurens en Mirthe). Elk heeft een Nederlands woord dat echt met die letter begint (bij i: iglo, niet ijs). Bij **Begint met** hoor je na een goed antwoord bijvoorbeeld "De f van fiets!". Bij **Klinkers** sleep je de ontbrekende klank in een kort woord ("Welke klank mist er in maan?") en hoor je daarna "Ja, maan!".

**Puzzels**
8. **Schuifpuzzel** — een plaatje in 4 (2×2) of 9 (3×3) stukken; tik op twee stukjes om ze te wisselen. Er is een vaag voorbeeldplaatje zichtbaar.
9. **Vormen passen** — sleep cirkel, vierkant, driehoek en andere vormen in het juiste gaatje (later ook gedraaid).
10. **Spiegelen** — tik de lege vakjes aan om de andere helft van het figuur hetzelfde te maken.
11. **Natekenen** — kijk naar het figuur op de stippen en teken de lijnen na op het lege raster.
12. **Tangram** — sleep 3 of 4 grote stukken in de silhouet (huis, boot, boom). Later kun je tikken om te draaien.
13. **Wat hoort waar?** — kies het plaatje waarop de beer op, onder, naast, achter, voor of in de tafel of doos zit.
14. **Doolhofje** — zoek met je vinger de weg van het kind naar het huis. Je kiest klein (5×5), middel (7×7) of groot (9×9). Een ronde is vijf nieuwe doolhoven, daarna ga je terug naar Puzzels. Teruglopen wist het pad; muren houden je tegen.
15. **Zoek de verschillen** — twee vrolijke plaatjes naast elkaar (onder elkaar in portret). Zoek de vijf verschillen; tik je er één aan, dan komt er een cirkel omheen op beide plaatjes. Een fout tikje schudt even, zonder straf. Een ronde is drie plaatjes, daarna ga je terug naar Puzzels.

**Tekenen**
15. **Vrij tekenen** — teken zelf met dikke kleuren, drie lijndiktes, een spuitbus en een gum. Wissen vraagt eerst even of het echt mag. Geen sterren, je tekent zo lang je wilt.
16. **Kleurplaten** — kies een plaat (monstertruck, dino, raket, draak, eenhoorn, brandweerauto, piratenschip, boerderijdieren, kasteel, vliegtuig, prinses of onderwater) en tik in de vlakken om ze te kleuren. Je kunt ook zelf bijtekenen.

**Geheugen**
15. **Memory** — draai de kaartjes om en zoek twee dezelfde. Je kiest 6, 12 of 16 kaartjes (3×2, 4×3 of 4×4). Een heel bord is één ster; daarna ga je terug naar het Geheugen-menu.
16. **Wat is er weg?** — kijk naar vier plaatjes; één verdwijnt, en je tikt wat er weg is.
17. **Simon zegt** — kijk en luister naar de gekleurde knoppen en tik dezelfde volgorde na. De rij wordt steeds een stukje langer.
18. **Onthoud de rij** — onthoud de plaatjes in volgorde en tik ze daarna in dezelfde volgorde na.
19. **Waar zat het?** — kijk onder welk dopje het plaatje zit, volg de wissel, en tik het goede dopje aan.
20. **Wat is er veranderd?** — kijk naar vier plaatjes; één verandert, en je tikt welk plaatje anders is geworden.

Bij de getallen- en letterspellen heeft elke vraag drie grote antwoordknoppen. Bij een goed antwoord of een voltooide puzzel krijg je een ster. Na vijf sterren volgt een klein feestje; daarna ga je terug naar het menu van dat spel. Een fout antwoord is niet erg: je mag het gewoon nog eens proberen.


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
