-- =========================================================
-- Inkoopstrategie Backend - testdata.sql
-- Test data for local development (NOT run automatically)
-- =========================================================
-- Dit bestand bevat demo-gebruikers, collecties, en flows voor testen.
-- Deze data wordt NIET automatisch geladen bij database setup.
--
-- Om deze testdata handmatig te laden:
--   docker exec -i inkoop-db psql -U postgres -d inkoopsstrategie < testdata.sql
--
-- Bevat:
--   - 6 testgebruikers (k.bouwens, i.van.de.beek, r.van.den.enden, etc.)
--   - Demo collecties en flows met embedded prompts
--   - Gebruikte tijdens initiële test (oktober 2024 - februari 2025)
-- =========================================================

DO $$
DECLARE
    v_user_id        uuid;
    v_collection_id  uuid;
    v_flow_id        uuid;
BEGIN
    -- Maak test user aan
    INSERT INTO users (email, display_name, hashed_password, idp_provider, idp_subject)
    VALUES (
        'k.bouwens@amsterdam.nl',
        'Kasper Bouwens',
        '$2b$12$nEWLrALn8hOSBtxv1cm8ue6O4geZAadwBCUN35/cjZ8MmfGDHNbPO', -- "secret123!"
        NULL,
        NULL
    )
    RETURNING id INTO v_user_id;

    -- Koppel collection aan deze user
    INSERT INTO collections (user_id, name, description)
    VALUES (
        v_user_id,
        'Inkoopstrategie voor E-bike beheer',
        'Demo-collectie voor het testen van de frontend en API'
    )
    RETURNING id INTO v_collection_id;

    -- Voeg flow (hoofdstuk) toe
    INSERT INTO flows (
        collection_id,
        name,
        description,
        context_content,
        template_name,
        template_content
    )
    VALUES (
        v_collection_id,
        'inleiding',
        'Hoofdstuk 2: Evaluatie huidige overeenkomst',
        NULL,
        'evaluatie_huidige_overeenkomst',
        'Je bent een beleidsadviseur sociaal domein bij een gemeente en stelt het hoofdstuk "# 2 Evaluatie Huidige overeenkomst" op binnen een inkoopdocument. Gebruik de geüploade documenten (zoals het vorige contract, evaluatierapporten, sessieverslagen en casusmateriaal) om de volgende onderdelen te vullen volgens deze structuur: 

        ## 2.1 Samenvatting huidige overeenkomst

        ### Scope van de Overeenkomst
        Beschrijf hier de scope van de huidige opdracht.

        ### Gestelde doelen
        Beschrijf de doelstellingen.

        ### Invulling beleidsdoelen
        Indien van toepassing, geef aan op welke wijze invulling is gegeven aan de beleidsdoelen van Amsterdam.'
    )
    RETURNING id INTO v_flow_id;

    -- Voeg checkboxes toe aan flow
    INSERT INTO flow_checkboxes (flow_id, name, checked)
    VALUES
        (v_flow_id, 'Volledigheid van de inhoud', FALSE),
        (v_flow_id, 'Feitelijke juistheid', FALSE),
        (v_flow_id, 'Bronvermelding correct', FALSE),
        (v_flow_id, 'Opmaak en leesbaarheid', FALSE);

END
$$;

-- Voeg extra gebruikers toe
INSERT INTO users (email, display_name, hashed_password, idp_provider, idp_subject)
    VALUES
        ('r.van.den.enden@amsterdam.nl', 'Rianne van Enden', '$2b$12$nEWLrALn8hOSBtxv1cm8ue6O4geZAadwBCUN35/cjZ8MmfGDHNbPO', NULL, NULL),
        ('i.van.de.beek@amsterdam.nl', 'Irma vd Beek', '$2b$12$nEWLrALn8hOSBtxv1cm8ue6O4geZAadwBCUN35/cjZ8MmfGDHNbPO', NULL, NULL),
        ('g.file@amsterdam.nl', 'Gwendelien File', '$2b$12$nEWLrALn8hOSBtxv1cm8ue6O4geZAadwBCUN35/cjZ8MmfGDHNbPO', NULL, NULL),
        ('Y.Bomba@amsterdam.nl', 'Yesim Bomba', '$2b$12$nEWLrALn8hOSBtxv1cm8ue6O4geZAadwBCUN35/cjZ8MmfGDHNbPO', NULL, NULL),
        ('h.el.hadaoui@amsterdam.nl', 'Hamida El Hadoui', '$2b$12$nEWLrALn8hOSBtxv1cm8ue6O4geZAadwBCUN35/cjZ8MmfGDHNbPO', NULL, NULL);

DO $$
DECLARE
    v_user_id       users.id%TYPE;
    v_collection_id collections.id%TYPE;
    v_flow_id       flows.id%TYPE;
    marktanalyse_prompt   text := $MARKT$ 
Hoofdstuk 5 Marktanalyse

# Context
We werken aan een inkoopstrategie voor een gemeentelijke opdracht. Je krijgt één of meer brondocumenten, zoals:
- evaluaties van de huidige overeenkomst en prestaties van aanbieders;
- marktverkenningen en/of marktconsultaties;
- beleidsdocumenten (bijvoorbeeld sociaal domein, duurzaamheid, doelmatigheid);
- financiële gegevens (volume, aantal cliënten/gebruikers, trendinformatie);
- eerdere inkoopstrategieën voor vergelijkbare opdrachten.

In deze opdracht moet je Hoofdstuk 5 Marktanalyse schrijven. Gebruik de bronnen als belangrijkste input en gebruik een eerder uitgewerkte marktanalyse uit een gemeentelijke inkoopstrategie als referentie voor opbouw en detailniveau, maar herschrijf alles in je eigen woorden.

# Objective
Schrijf een compleet en logisch opgebouwd hoofdstuk 5 Marktanalyse dat:
- de relevante marktpartijen, marktstructuur, trends en ontwikkelingen schetst;
- laat zien hoe de marktsituatie de keuze en inrichting van de aanbestedingsprocedure beïnvloedt;
- de belangrijkste risico’s en kansen vanuit de markt benoemt en vertaalt naar de inkoopstrategie;
- leesbaar is voor interne collega’s en direct in de inkoopstrategie gebruikt kan worden.

# Style
- Schrijf in het Nederlands, in heldere taal (ongeveer B1), met korte zinnen, actieve formuleringen en duidelijke kopjes.
- Gebruik begrijpelijke woorden en leg vakjargon zo veel mogelijk in gewone taal uit.
- Begin elke paragraaf met de kern en werk daarna de toelichting uit.
- Gebruik waar passend opsommingen voor kenmerken van de markt, risico’s, kansen en trends.
- Schrijf van mens tot mens: gebruik “wij” voor de gemeente en “de opdrachtnemer/de aanbieders/de marktpartijen” voor de markt.

# Tone
Zakelijk, professioneel en nuchter, met oog voor de uitvoeringspraktijk. Geen marketingtaal, geen overdreven optimisme. Wees eerlijk over onzekerheden, aannames en risico’s in de markt.

# Audience
Het hoofdstuk is bedoeld voor:
- beleidsadviseurs en inkoopadviseurs die de strategie voorbereiden en verantwoorden;
- contractmanagers die later op deze analyse willen teruggrijpen;
- juristen en controllers die willen zien of de gekozen aanbestedingsstrategie proportioneel en uitlegbaar is.

Schrijf zo dat iemand zonder diepgaande marktkennis de belangrijkste punten en afwegingen snel begrijpt.

# Response

1. Structuur en kopjes
Schrijf het hoofdstuk in de volgende structuur. Neem de kopjes en nummering precies over. De tekst tussen < > is een instructie voor jou en mag niet letterlijk in de output staan.

# 5 Marktanalyse

## 5.1 Geschikte marktpartijen en marktsituatie
<Beschrijf het (gewenste) profiel van de opdrachtnemer(s) die de opdracht kan/kunnen uitvoeren: benodigde competenties, capaciteit, ervaring, kwaliteits- en samenwerkingsaspecten. Beschrijf de belangrijkste kenmerken van de huidige marktsituatie die bepalend zijn voor de keuze en inrichting van de aanbestedingsprocedure. Denk aan:
- de omvang van de markt (financieel volume, aantallen opdrachtgevers en opdrachten);
- de positie en het aandeel van de gemeente in de totale markt;
- het aantal bedrijven in de markt (monopolie, oligopolie, polypolie) en de typen aanbieders;
- marktspanning en dynamiek (nieuwe toetreders, fusies, specialisatie);
- mate van volwassenheid/professionaliteit van de markt;
- groei of krimp en belangrijke trends;
- relevante wettelijke beperkingen of regulering van de markt.
Eindig met een korte conclusie over hoeveel geschikte aanbieders er zijn en hoeveel inschrijvingen we realistisch verwachten.>

## 5.2 Marktverkenning en -consultatie
<Geef aan of er een marktverkenning en/of marktconsultatie heeft plaatsgevonden. Beschrijf kort de opzet (bijvoorbeeld: gesprekken met aanbieders, enquête, informele afstemming met andere gemeenten) en vat vervolgens de belangrijkste uitkomsten samen. Benoem wat de markt aangeeft over:
- de uitvoerbaarheid van de opdracht en gevraagde kwaliteit;
- mogelijke knelpunten (bijvoorbeeld bereikbaarheid, personeelsschaarste, prijsdruk, duurzaamheidseisen);
- suggesties van aanbieders voor een passende contract- en aanbestedingsvorm;
- aandachtspunten voor prijs, risicoverdeling en samenwerking.
Maak duidelijk hoe deze inzichten zijn vertaald naar de verdere uitwerking van de inkoopstrategie.>

## 5.3 Risico’s en kansen vanuit de markt
<Beschrijf de belangrijkste risico’s (ongewenste gebeurtenissen) die voortkomen uit de marktsituatie voor deze opdracht, geef kort de oorzaken en mogelijke beheersmaatregelen (in contract en aanbestedingsprocedure). Benoem daarnaast de belangrijkste kansen die de markt biedt en hoe we die via de inkoop zo goed mogelijk kunnen benutten. Waar relevant kun je dit in tekst óf in een compacte tabel uitwerken met kolommen als: “Omschrijving risico”, “Oorzaak”, “Beheersmaatregel in inkoop” en “Kans / kansmaatregel”.>

2. Gebruik van bronnen en voorbeeldhoofdstuk
- Gebruik de meegeleverde documenten als primaire bron voor feiten en voorbeelden.
- Gebruik het voorbeeldhoofdstuk Marktanalyse alleen als referentie voor de diepgang en opbouw, maar kopieer geen tekst of specifieke namen, aantallen of bedragen.

3. Omgaan met onzekerheid en ontbrekende informatie
- Als bronnen weinig zeggen over een onderdeel (bijvoorbeeld het aantal aanbieders of exacte marktvolumes), geef dan een beargumenteerde, voorzichtige omschrijving in plaats van exacte cijfers.
- Benoem expliciet waar informatie ontbreekt en welke aanvullende analyse of monitoring wenselijk zou zijn.

4. Geen meta-tekst
Schrijf alleen de inhoud van het hoofdstuk; neem geen uitleg op over bronnen, prompts of jouw werkwijze.)
$MARKT$ AS marktanalyse_prompt;


aanbesteding_prompt   text := $AANB$
Hoofdstuk 9 Aanbestedingsprocedure

# Context
We werken aan een inkoopstrategie voor een gemeentelijke opdracht. Je krijgt brondocumenten zoals:
- beleids- en kaderdocumenten over inkoop en aanbesteding;
- juridische notities over toepasselijke regelgeving en drempelbedragen;
- marktanalyse en risicoanalyse;
- concept-leidraad of eerdere aanbestedingsdocumenten voor vergelijkbare opdrachten;
- interne notities over budget, scope en risicoverdeling.

In deze opdracht moet je Hoofdstuk 9 Aanbestedingsprocedure schrijven. Gebruik de bronnen als belangrijkste input en gebruik een eerder uitgewerkt hoofdstuk Aanbestedingsprocedure als referentie voor opbouw en detailniveau, maar herschrijf alles in jouw eigen woorden en zonder specifieke namen, cijfers of bedragen over te nemen.

# Objective
Schrijf een volledig en uitlegbaar hoofdstuk 9 Aanbestedingsprocedure dat:
- het juridisch kader en de gekozen aanbestedingsprocedure helder samenvat;
- de keuze voor het type procedure en de belangrijkste inrichting (stappen, selectie, gunning, prijs) motiveert;
- laat zien dat de procedure proportioneel, doelmatig en passend bij de marktsituatie is;
- een solide basis biedt voor de latere leidraad en voor interne besluitvorming.

# Style
- Schrijf in het Nederlands, in heldere taal (ongeveer B1), met korte, actieve en duidelijke zinnen.
- Combineer juridische precisie met leesbaarheid: noodzakelijke wet- en artikelverwijzingen formuleer je correct, maar je vermijdt onnodig ingewikkelde formuleringen.
- Begin paragrafen met de kern (bijvoorbeeld: “Wij kiezen voor een openbare Europese aanbesteding omdat…”) en werk daarna de onderbouwing uit.

# Tone
Professioneel, zorgvuldig en transparant. Laat zien dat de gemeente bewuste keuzes maakt op basis van wetgeving, beleid, marktsituatie en risico’s. Vermijd marketingtaal en blijf feitelijk.

# Audience
Het hoofdstuk is bedoeld voor:
- beleidsadviseurs en inkoopadviseurs die de aanbesteding voorbereiden;
- juristen die de gekozen procedure en onderbouwing toetsen;
- controllers en management die moeten instemmen met de voorgestelde aanpak.

Zorg dat zij snel kunnen zien welke procedure gekozen is, waarom, en wat de belangrijkste juridische en strategische overwegingen zijn.

# Response

1. Structuur en kopjes
Schrijf het hoofdstuk in de volgende structuur. Neem de kopjes en nummering precies over. De tekst tussen < > is een instructie voor jou en mag niet letterlijk in de output staan.

# 9 Aanbestedingsprocedure
<Beschrijf inleidend dat de keuze voor een type aanbestedingsprocedure afhangt van meerdere factoren (regelgeving, budget, type inkoopbehoefte, marktsituatie) en dat de gemeente op objectieve gronden moet motiveren welke procedure wordt toegepast. Benoem dat de gekozen procedure zowel rechtmatig (volgens Aanbestedingswet, Gids Proportionaliteit, inkoopbeleid) als doelmatig moet zijn, en dat we kiezen voor de meest effectieve procedure die met de minste kosten voorziet in de inkoopbehoefte. Vat het juridisch kader in enkele bullets samen (aanbestedende dienst, type opdracht, geraamde waarde t.o.v. drempelbedragen, wijze van publiceren, toegepast juridisch kader).>

## 9.1 Type en inrichting aanbestedingsprocedure
<Benoem en motiveer welke aanbestedingsprocedure gekozen wordt (bijvoorbeeld openbare Europese procedure, nationaal openbare procedure, meervoudig onderhandse aanbesteding, etc.) en leg uit waarom deze het beste past bij de opgave, de marktsituatie en het budget. Beschrijf op hoofdlijnen hoe de procedure wordt ingericht (belangrijkste stappen, planning op hoofdlijnen, beoogde verdeling van percelen/kavels indien aan de orde). Maak duidelijk welke alternatieve procedurevormen zijn overwogen, waarom die minder geschikt zijn en hoe de gemaakte keuze proportioneel is.>

## 9.2 Geschiktheidseisen
<Beschrijf op hoofdlijnen aan welke geschiktheidseisen (bijvoorbeeld financiële draagkracht, technische bekwaamheid, kwaliteitssystemen, ervaring met de doelgroep/opdracht) de opdrachtnemer ten minste moet voldoen. Het is niet nodig om de eisen volledig uit te schrijven; dat gebeurt in de leidraad. Licht kort toe waarom deze eisen proportioneel zijn en aansluiten bij de aard en risico’s van de opdracht.>

## 9.3 Selectiecriteria (optioneel)
<Als er een selectiefase is, beschrijf op hoofdlijnen of, en op welke manier, selectiecriteria worden toegepast (bijvoorbeeld beperking van het aantal partijen dat mag inschrijven). Benoem de hoofdgedachte achter de selectiecriteria en waarom gekozen wordt voor deze aanpak. Maak duidelijk dat de nadere uitwerking in de leidraad gebeurt. Als er géén selectiefase is, leg kort uit waarom niet.>

## 9.4 Gunningscriteria
<Beschrijf op hoofdlijnen de gunningssystematiek (bijvoorbeeld “beste prijs-kwaliteitsverhouding”) en de belangrijkste kwalitatieve gunningscriteria. Houd een maximum van ongeveer drie hoofdcriteria aan en licht kort toe waarom voor deze criteria is gekozen. Beschrijf in woorden wat ongeveer de verhouding prijs/kwaliteit is en waarom dit passend is bij de opdracht en de risico’s. Je hoeft geen gedetailleerde puntentabellen op te nemen; die komen in de leidraad. Laat wel zien dat de verhouding tussen prijs en kwaliteit proportioneel en uitlegbaar is.>

## 9.5 Specifieke voorzieningen in de aanbestedingsprocedure
<Beschrijf of er bijzondere voorzieningen of afspraken in de aanbestedingsprocedure worden opgenomen, zoals:
- tegemoetkoming in inschrijvingskosten;
- specifieke voorwaarden aan de inschrijving;
- bijzondere bepalingen rond vragenronde, dialoogmomenten, presentaties, proefopstellingen of pilots;
- afspraken rond duurzaamheid, social return of andere beleidsdoelen die in de procedurevorm tot uitdrukking komen.
Je kunt hiervoor subkopjes gebruiken zoals 9.5.1 en 9.5.2 als dat helpt, maar houd het op hoofdlijnen. Leg kort uit waarom gekozen is voor deze voorzieningen en hoe dit past binnen proportionaliteit.>

## 9.6 Motiveringen en afwijkingen
<Beschrijf de belangrijkste motiveringen van de gekozen aanbestedingsaanpak in het licht van de Aanbestedingswet, Gids Proportionaliteit en het inkoopbeleid van de gemeente. Geef aan of er (beperkte) afwijkingen zijn van standaardkaders, beleid of algemene inkoopvoorwaarden en motiveer deze kort. Maak duidelijk dat eventuele afwijkingen noodzakelijk, proportioneel en goed verdedigbaar zijn, en dat zij later in de leidraad en besluitvorming verder worden vastgelegd.>

2. Gebruik van bronnen en voorbeeldhoofdstuk
- Gebruik het voorbeeldhoofdstuk Aanbestedingsprocedure alleen als referentie voor hoe het juridisch kader compact kan worden samengevat, hoe type en inrichting van de procedure worden beschreven en hoe geschiktheidseisen en gunningscriteria op hoofdlijnen worden uitgelegd.
- Neem geen concrete namen van documenten, specifieke CPV-codes, exacte bandbreedtes of cijfers letterlijk over. Vertaal die naar generieke formuleringen, tenzij de bron én de context expliciet vragen om exactheid.

3. Omgaan met onzekerheid en ontbrekende informatie
- Als de bronnen nog geen definitieve keuzes bevatten (bijvoorbeeld over exacte gunningscriteria of verhouding prijs/kwaliteit), schrijf dan wat nu het voorgenomen kader is en benoem dat detaillering volgt in de leidraad.
- Wees duidelijk als er nog beleidsmatige of juridische keuzes openstaan.

4. Geen meta-tekst
Schrijf alleen de tekst van het hoofdstuk en verwijs niet naar prompts, templates of je eigen werkwijze.)
$AANB$ AS aanbesteding_prompt;
BEGIN
    ----------------------------------------------------------------------
    -- Irma vd Beek
    -- Collecties:
    -- - AIS-2021-0002 (Individueel) Psychodiagnostisch onderzoek (IPO)
    -- - AIS-2021-0020 Budgetbeheer
    ----------------------------------------------------------------------
    SELECT id
    INTO v_user_id
    FROM users
    WHERE email = 'i.van.de.beek@amsterdam.nl';

    IF v_user_id IS NULL THEN
        RAISE NOTICE 'User with email % not found, skipping', 'i.van.de.beek@amsterdam.nl';
    ELSE
        -- Collection 1: AIS-2021-0002 (Individueel) Psychodiagnostisch onderzoek (IPO)
        INSERT INTO collections (user_id, name, description)
        VALUES (
            v_user_id,
            'AIS-2021-0002 (Individueel) Psychodiagnostisch onderzoek (IPO)',
            'Demo-collectie voor user test'
        )
        RETURNING id INTO v_collection_id;

        -- Flow: Hoofdstuk 5 Marktanalyse
        INSERT INTO flows (
            collection_id,
            name,
            description,
            context_content,
            template_name,
            template_content
        )
        VALUES (
            v_collection_id,
            'Hoofdstuk 5 Marktanalyse',
            'Stelt hoofdstuk 5 Marktanalyse van de inkoopstrategie op',
            NULL,
            'hoofdstuk_5_marktanalyse',
            marktanalyse_prompt
        )
        RETURNING id INTO v_flow_id;

        INSERT INTO flow_checkboxes (flow_id, name, checked)
        VALUES
            (v_flow_id, 'Volledigheid van de inhoud', FALSE),
            (v_flow_id, 'Feitelijke juistheid', FALSE),
            (v_flow_id, 'Bronvermelding correct', FALSE),
            (v_flow_id, 'Opmaak en leesbaarheid', FALSE);

        -- Flow: Hoofdstuk 9 Aanbestedingsprocedure
        INSERT INTO flows (
            collection_id,
            name,
            description,
            context_content,
            template_name,
            template_content
        )
        VALUES (
            v_collection_id,
            'Hoofdstuk 9 Aanbestedingsprocedure',
            'Stelt hoofdstuk 9 Aanbestedingsprocedure van de inkoopstrategie op',
            NULL,
            'hoofdstuk_9_aanbestedingsprocedure',
            aanbesteding_prompt
        )
        RETURNING id INTO v_flow_id;

        INSERT INTO flow_checkboxes (flow_id, name, checked)
        VALUES
            (v_flow_id, 'Volledigheid van de inhoud', FALSE),
            (v_flow_id, 'Feitelijke juistheid', FALSE),
            (v_flow_id, 'Bronvermelding correct', FALSE),
            (v_flow_id, 'Opmaak en leesbaarheid', FALSE);

        -- Collection 2: AIS-2021-0020 Budgetbeheer
        INSERT INTO collections (user_id, name, description)
        VALUES (
            v_user_id,
            'AIS-2024-0007 Loopbaanpaden Zorg en Welzijn',
            'Demo-collectie voor user test'
        )
        RETURNING id INTO v_collection_id;

        -- Flow: Hoofdstuk 5 Marktanalyse
        INSERT INTO flows (
            collection_id,
            name,
            description,
            context_content,
            template_name,
            template_content
        )
        VALUES (
            v_collection_id,
            'Hoofdstuk 5 Marktanalyse',
            'Stelt hoofdstuk 5 Marktanalyse van de inkoopstrategie op',
            NULL,
            'hoofdstuk_5_marktanalyse',
            marktanalyse_prompt
        )
        RETURNING id INTO v_flow_id;

        INSERT INTO flow_checkboxes (flow_id, name, checked)
        VALUES
            (v_flow_id, 'Volledigheid van de inhoud', FALSE),
            (v_flow_id, 'Feitelijke juistheid', FALSE),
            (v_flow_id, 'Bronvermelding correct', FALSE),
            (v_flow_id, 'Opmaak en leesbaarheid', FALSE);

        -- Flow: Hoofdstuk 9 Aanbestedingsprocedure
        INSERT INTO flows (
            collection_id,
            name,
            description,
            context_content,
            template_name,
            template_content
        )
        VALUES (
            v_collection_id,
            'Hoofdstuk 9 Aanbestedingsprocedure',
            'Stelt hoofdstuk 9 Aanbestedingsprocedure van de inkoopstrategie op',
            NULL,
            'hoofdstuk_9_aanbestedingsprocedure',
            aanbesteding_prompt
        )
        RETURNING id INTO v_flow_id;

        INSERT INTO flow_checkboxes (flow_id, name, checked)
        VALUES
            (v_flow_id, 'Volledigheid van de inhoud', FALSE),
            (v_flow_id, 'Feitelijke juistheid', FALSE),
            (v_flow_id, 'Bronvermelding correct', FALSE),
            (v_flow_id, 'Opmaak en leesbaarheid', FALSE);
    END IF;

    ----------------------------------------------------------------------
    -- Rianne van Enden
    -- Collecties:
    -- - Budgetcoaches MBO 01- Voorbereiding, marktconsultatie, JEP, TB
    -- - AIS-2023-0048 PVT en MAP gezinsmigranten en overige migranten
    ----------------------------------------------------------------------
    SELECT id
    INTO v_user_id
    FROM users
    WHERE email = 'r.van.den.enden@amsterdam.nl';

    IF v_user_id IS NULL THEN
        RAISE NOTICE 'User with email % not found, skipping', 'r.van.den.enden@amsterdam.nl';
    ELSE
        -- Collection 1: Budgetcoaches MBO 01- ...
        INSERT INTO collections (user_id, name, description)
        VALUES (
            v_user_id,
            'Budgetcoaches MBO 01- Voorbereiding, marktconsultatie, JEP, TB',
            'Demo-collectie voor user test'
        )
        RETURNING id INTO v_collection_id;

        -- Flow 5 Marktanalyse
        INSERT INTO flows (
            collection_id,
            name,
            description,
            context_content,
            template_name,
            template_content
        )
        VALUES (
            v_collection_id,
            'Hoofdstuk 5 Marktanalyse',
            'Stelt hoofdstuk 5 Marktanalyse van de inkoopstrategie op',
            NULL,
            'hoofdstuk_5_marktanalyse',
            marktanalyse_prompt
        )
        RETURNING id INTO v_flow_id;

        INSERT INTO flow_checkboxes (flow_id, name, checked)
        VALUES
            (v_flow_id, 'Volledigheid van de inhoud', FALSE),
            (v_flow_id, 'Feitelijke juistheid', FALSE),
            (v_flow_id, 'Bronvermelding correct', FALSE),
            (v_flow_id, 'Opmaak en leesbaarheid', FALSE);

        -- Flow 9 Aanbestedingsprocedure
        INSERT INTO flows (
            collection_id,
            name,
            description,
            context_content,
            template_name,
            template_content
        )
        VALUES (
            v_collection_id,
            'Hoofdstuk 9 Aanbestedingsprocedure',
            'Stelt hoofdstuk 9 Aanbestedingsprocedure van de inkoopstrategie op',
            NULL,
            'hoofdstuk_9_aanbestedingsprocedure',
            aanbesteding_prompt
        )
        RETURNING id INTO v_flow_id;

        INSERT INTO flow_checkboxes (flow_id, name, checked)
        VALUES
            (v_flow_id, 'Volledigheid van de inhoud', FALSE),
            (v_flow_id, 'Feitelijke juistheid', FALSE),
            (v_flow_id, 'Bronvermelding correct', FALSE),
            (v_flow_id, 'Opmaak en leesbaarheid', FALSE);

        -- Collection 2: AIS-2023-0048 PVT en MAP gezinsmigranten en overige migranten
        INSERT INTO collections (user_id, name, description)
        VALUES (
            v_user_id,
            'AIS-2023-0048 PVT en MAP gezinsmigranten en overige migranten',
            'Demo-collectie voor user test'
        )
        RETURNING id INTO v_collection_id;

        -- Flow 5 Marktanalyse
        INSERT INTO flows (
            collection_id,
            name,
            description,
            context_content,
            template_name,
            template_content
        )
        VALUES (
            v_collection_id,
            'Hoofdstuk 5 Marktanalyse',
            'Stelt hoofdstuk 5 Marktanalyse van de inkoopstrategie op',
            NULL,
            'hoofdstuk_5_marktanalyse',
            marktanalyse_prompt
        )
        RETURNING id INTO v_flow_id;

        INSERT INTO flow_checkboxes (flow_id, name, checked)
        VALUES
            (v_flow_id, 'Volledigheid van de inhoud', FALSE),
            (v_flow_id, 'Feitelijke juistheid', FALSE),
            (v_flow_id, 'Bronvermelding correct', FALSE),
            (v_flow_id, 'Opmaak en leesbaarheid', FALSE);

        -- Flow 9 Aanbestedingsprocedure
        INSERT INTO flows (
            collection_id,
            name,
            description,
            context_content,
            template_name,
            template_content
        )
        VALUES (
            v_collection_id,
            'Hoofdstuk 9 Aanbestedingsprocedure',
            'Stelt hoofdstuk 9 Aanbestedingsprocedure van de inkoopstrategie op',
            NULL,
            'hoofdstuk_9_aanbestedingsprocedure',
            aanbesteding_prompt
        )
        RETURNING id INTO v_flow_id;

        INSERT INTO flow_checkboxes (flow_id, name, checked)
        VALUES
            (v_flow_id, 'Volledigheid van de inhoud', FALSE),
            (v_flow_id, 'Feitelijke juistheid', FALSE),
            (v_flow_id, 'Bronvermelding correct', FALSE),
            (v_flow_id, 'Opmaak en leesbaarheid', FALSE);
    END IF;

    ----------------------------------------------------------------------
    -- Gwendelien File
    -- Collecties:
    -- - AIS-2021-0005 PC Workshops (heraanbesteding)
    ----------------------------------------------------------------------
    SELECT id
    INTO v_user_id
    FROM users
    WHERE email = 'g.file@amsterdam.nl';

    IF v_user_id IS NULL THEN
        RAISE NOTICE 'User with email % not found, skipping', 'g.file@amsterdam.nl';
    ELSE
        INSERT INTO collections (user_id, name, description)
        VALUES (
            v_user_id,
            'AIS-2021-0005 PC Workshops (heraanbesteding)',
            'Demo-collectie voor user test'
        )
        RETURNING id INTO v_collection_id;

        -- Flow 5 Marktanalyse
        INSERT INTO flows (
            collection_id,
            name,
            description,
            context_content,
            template_name,
            template_content
        )
        VALUES (
            v_collection_id,
            'Hoofdstuk 5 Marktanalyse',
            'Stelt hoofdstuk 5 Marktanalyse van de inkoopstrategie op',
            NULL,
            'hoofdstuk_5_marktanalyse',
            marktanalyse_prompt
        )
        RETURNING id INTO v_flow_id;

        INSERT INTO flow_checkboxes (flow_id, name, checked)
        VALUES
            (v_flow_id, 'Volledigheid van de inhoud', FALSE),
            (v_flow_id, 'Feitelijke juistheid', FALSE),
            (v_flow_id, 'Bronvermelding correct', FALSE),
            (v_flow_id, 'Opmaak en leesbaarheid', FALSE);

        -- Flow 9 Aanbestedingsprocedure
        INSERT INTO flows (
            collection_id,
            name,
            description,
            context_content,
            template_name,
            template_content
        )
        VALUES (
            v_collection_id,
            'Hoofdstuk 9 Aanbestedingsprocedure',
            'Stelt hoofdstuk 9 Aanbestedingsprocedure van de inkoopstrategie op',
            NULL,
            'hoofdstuk_9_aanbestedingsprocedure',
            aanbesteding_prompt
        )
        RETURNING id INTO v_flow_id;

        INSERT INTO flow_checkboxes (flow_id, name, checked)
        VALUES
            (v_flow_id, 'Volledigheid van de inhoud', FALSE),
            (v_flow_id, 'Feitelijke juistheid', FALSE),
            (v_flow_id, 'Bronvermelding correct', FALSE),
            (v_flow_id, 'Opmaak en leesbaarheid', FALSE);

            -- Collection 2: AIS-2025-0008 GGD Meldkamerdiensten
        INSERT INTO collections (user_id, name, description)
        VALUES (
            v_user_id,
            'AIS-2025-0008 GGD Meldkamerdienstn',
            'Demo-collectie voor user test'
        )
        RETURNING id INTO v_collection_id;

        -- Flow 5 Marktanalyse (Meldkamerdiensten)
        INSERT INTO flows (
            collection_id,
            name,
            description,
            context_content,
            template_name,
            template_content
        )
        VALUES (
            v_collection_id,
            'Hoofdstuk 5 Marktanalyse',
            'Stelt hoofdstuk 5 Marktanalyse van de inkoopstrategie op (GGD Meldkamerdiensten)',
            NULL,
            'hoofdstuk_5_marktanalyse',
            marktanalyse_prompt
        )
        RETURNING id INTO v_flow_id;

        INSERT INTO flow_checkboxes (flow_id, name, checked)
        VALUES
            (v_flow_id, 'Volledigheid van de inhoud', FALSE),
            (v_flow_id, 'Feitelijke juistheid', FALSE),
            (v_flow_id, 'Bronvermelding correct', FALSE),
            (v_flow_id, 'Opmaak en leesbaarheid', FALSE);

        -- Flow 9 Aanbestedingsprocedure (Meldkamerdiensten)
        INSERT INTO flows (
            collection_id,
            name,
            description,
            context_content,
            template_name,
            template_content
        )
        VALUES (
            v_collection_id,
            'Hoofdstuk 9 Aanbestedingsprocedure',
            'Stelt hoofdstuk 9 Aanbestedingsprocedure van de inkoopstrategie op (GGD Meldkamerdiensten)',
            NULL,
            'hoofdstuk_9_aanbestedingsprocedure',
            aanbesteding_prompt
        )
        RETURNING id INTO v_flow_id;

        INSERT INTO flow_checkboxes (flow_id, name, checked)
        VALUES
            (v_flow_id, 'Volledigheid van de inhoud', FALSE),
            (v_flow_id, 'Feitelijke juistheid', FALSE),
            (v_flow_id, 'Bronvermelding correct', FALSE),
            (v_flow_id, 'Opmaak en leesbaarheid', FALSE);

    END IF;

    ----------------------------------------------------------------------
    -- Hamida El Hadoui (El Haloui)
    -- Collecties:
    -- - AIS-2021-0013 Aanvullende Individuele Ondersteuning
    -- - AIS-2018-0029 Forensisch Netwerk (nieuwe aanbesteding)
    ----------------------------------------------------------------------
    SELECT id
    INTO v_user_id
    FROM users
    WHERE email = 'h.el.hadaoui@amsterdam.nl';

    IF v_user_id IS NULL THEN
        RAISE NOTICE 'User with email % not found, skipping', 'h.el.hadaoui@amsterdam.nl';
    ELSE
        -- Collection 1
        INSERT INTO collections (user_id, name, description)
        VALUES (
            v_user_id,
            'AIS-2021-0013 Aanvullende Individuele Ondersteuning',
            'Demo-collectie voor user test'
        )
        RETURNING id INTO v_collection_id;

        -- Flow 5 Marktanalyse
        INSERT INTO flows (
            collection_id,
            name,
            description,
            context_content,
            template_name,
            template_content
        )
        VALUES (
            v_collection_id,
            'Hoofdstuk 5 Marktanalyse',
            'Stelt hoofdstuk 5 Marktanalyse van de inkoopstrategie op',
            NULL,
            'hoofdstuk_5_marktanalyse',
            marktanalyse_prompt
        )
        RETURNING id INTO v_flow_id;

        INSERT INTO flow_checkboxes (flow_id, name, checked)
        VALUES
            (v_flow_id, 'Volledigheid van de inhoud', FALSE),
            (v_flow_id, 'Feitelijke juistheid', FALSE),
            (v_flow_id, 'Bronvermelding correct', FALSE),
            (v_flow_id, 'Opmaak en leesbaarheid', FALSE);

        -- Flow 9 Aanbestedingsprocedure
        INSERT INTO flows (
            collection_id,
            name,
            description,
            context_content,
            template_name,
            template_content
        )
        VALUES (
            v_collection_id,
            'Hoofdstuk 9 Aanbestedingsprocedure',
            'Stelt hoofdstuk 9 Aanbestedingsprocedure van de inkoopstrategie op',
            NULL,
            'hoofdstuk_9_aanbestedingsprocedure',
            aanbesteding_prompt
        )
        RETURNING id INTO v_flow_id;

        INSERT INTO flow_checkboxes (flow_id, name, checked)
        VALUES
            (v_flow_id, 'Volledigheid van de inhoud', FALSE),
            (v_flow_id, 'Feitelijke juistheid', FALSE),
            (v_flow_id, 'Bronvermelding correct', FALSE),
            (v_flow_id, 'Opmaak en leesbaarheid', FALSE);

        -- Collection 2
        INSERT INTO collections (user_id, name, description)
        VALUES (
            v_user_id,
            'AIS-2018-0029 Forensisch Netwerk (nieuwe aanbesteding)',
            'Demo-collectie voor user test'
        )
        RETURNING id INTO v_collection_id;

        -- Flow 5 Marktanalyse
        INSERT INTO flows (
            collection_id,
            name,
            description,
            context_content,
            template_name,
            template_content
        )
        VALUES (
            v_collection_id,
            'Hoofdstuk 5 Marktanalyse',
            'Stelt hoofdstuk 5 Marktanalyse van de inkoopstrategie op',
            NULL,
            'hoofdstuk_5_marktanalyse',
            marktanalyse_prompt
        )
        RETURNING id INTO v_flow_id;

        INSERT INTO flow_checkboxes (flow_id, name, checked)
        VALUES
            (v_flow_id, 'Volledigheid van de inhoud', FALSE),
            (v_flow_id, 'Feitelijke juistheid', FALSE),
            (v_flow_id, 'Bronvermelding correct', FALSE),
            (v_flow_id, 'Opmaak en leesbaarheid', FALSE);

        -- Flow 9 Aanbestedingsprocedure
        INSERT INTO flows (
            collection_id,
            name,
            description,
            context_content,
            template_name,
            template_content
        )
        VALUES (
            v_collection_id,
            'Hoofdstuk 9 Aanbestedingsprocedure',
            'Stelt hoofdstuk 9 Aanbestedingsprocedure van de inkoopstrategie op',
            NULL,
            'hoofdstuk_9_aanbestedingsprocedure',
            aanbesteding_prompt
        )
        RETURNING id INTO v_flow_id;

        INSERT INTO flow_checkboxes (flow_id, name, checked)
        VALUES
            (v_flow_id, 'Volledigheid van de inhoud', FALSE),
            (v_flow_id, 'Feitelijke juistheid', FALSE),
            (v_flow_id, 'Bronvermelding correct', FALSE),
            (v_flow_id, 'Opmaak en leesbaarheid', FALSE);
    END IF;
END
$$ LANGUAGE plpgsql;
