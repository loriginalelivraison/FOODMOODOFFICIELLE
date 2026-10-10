import osmDestinations from "./osmDestinations.js";

// Table locale de Mostaganem. Coordonnées fournies, accès routiers non vérifiés.
const communes = [
  [1, "مستغانم", "Mostaganem", 35.9751637, 0.0448868],
  [2, "مزغران", "Mazagran", 35.8844492, 0.0250619],
  [3, "حاسي ماماش", "Hassi Mamèche", 35.8606343, 0.0229141],
  [4, "استيدية", "Stidia", 35.8286516, -0.0143553],
  [5, "عين تادلس", "Aïn Tédelès", 35.9940136, 0.2932405],
  [6, "الصور", "Sour", 36.0006026, 0.3356516],
  [7, "وادي الخير", "Oued El Kheir", 35.9498792, 0.3768825],
  [8, "سيدي بلعطار", "Sidi Belattar", 36.0267851, 0.2672123],
  [9, "بوقيراط", "Bouguirat", 35.7512830, 0.2465079],
  [10, "سيرات", "Sirat", 35.7805820, 0.1835710],
  [11, "الصفصاف", "Safsaf", 35.8436642, 0.3698229],
  [12, "السوافلية", "Souaflia", 35.8616131, 0.3271866],
  [13, "سيدي علي", "Sidi Ali", 36.0968612, 0.3972458],
  [14, "تازقايت", "Tazgait", 36.0944945, 0.5438018],
  [15, "أولاد مع الله", "Ouled Maallah", 36.0072076, 0.5870175],
  [16, "عشعاشة", "Achaacha", 36.2449302, 0.6235599],
  [17, "نقمارية", "Nekmaria", 36.1880382, 0.6165754],
  [18, "خضرة", "Khadra", 36.2538598, 0.5688214],
  [19, "أولاد بوغالم", "Ouled Boughalem", 36.3160232, 0.6610250],
  [20, "عين النويصي", "Aïn Nouissy", 35.8032737, 0.0398253],
  [21, "فرناكة", "Fornaka", 35.7604979, -0.0327569],
  [22, "الحسيان", "El Hassiane", 35.7530845, 0.1155925],
  [23, "ماسرة", "Mesra", 35.8389326, 0.1574992],
  [24, "منصورة", "Mansourah", 35.8432384, 0.2285671],
  [25, "الطواهرية", "Touahria", 35.8109224, 0.2054358],
  [26, "عين سيدي الشريف", "Aïn Sidi Chérif", 35.8358105, 0.1163113],
  [27, "سيدي لخضر", "Sidi Lakhdar", 36.1633785, 0.4315995],
  [28, "حجاج", "Hadjadj", 36.0963942, 0.3163505],
  [29, "عبد المالك رمضان", "Abdelmalek Ramdane", 36.1034611, 0.2672312],
  [30, "خير الدين", "Kheireddine", 35.9549081, 0.1016209],
  [31, "صيادة", "Sayada", 35.9321147, 0.0894758],
  [32, "عين بودينار", "Aïn Boudinar", 36.0091691, 0.1825405],
];
const plusPrecision = "centre de cellule Plus Code, non vérifié pour routage";
const plusStatus = "code Plus publié ; centre de cellule, accès à vérifier";
const sourcedStatus = "position sourcée ; accès routier à vérifier";
const publicStatus = "coordonnée publique localisée ; accès routier à confirmer";
const geographicSource = "source géographique publiée";
const mapcartaSource = "OpenStreetMap / GeoNames via Mapcarta";
const categoryLabels = {
  Commune: "بلدية", Loisirs: "ترفيه", Commerce: "تجارة", Hôtel: "فندق",
  Plage: "شاطئ", Stade: "ملعب", Administration: "إدارة", Justice: "محكمة",
  Port: "ميناء", Pâtisserie: "حلويات", "Café / pâtisserie": "مقهى وحلويات",
  Pizzeria: "بيتزا", "Centre commercial": "مركز تجاري", Restaurant: "مطعم", Quartier: "حي",
};
const places = [
  [33, "موستالاند", "Mostaland", "Loisirs", "Mostaganem", 35.95662, 0.09773, sourcedStatus, geographicSource, "OSM way 365149459 ; centre du parc"],
  [34, "المركز التجاري لويزة", "Centre commercial Louisa", "Commerce", "Mostaganem", 35.9306875, 0.0885625, plusStatus, "https://www.africabizinfo.com/fr-DZ/centre-commercial-louisa_1L", plusPrecision],
  [35, "فندق أز مونتانا", "AZ Hôtels Montana", "Hôtel", "Mostaland", 35.9531875, 0.0943125, plusStatus, "business listing: AZ Hôtels Montana", plusPrecision],
  [40, "شاطئ الصابلات", "Plage des Sablettes", "Plage", "Mazagran", 35.8905375, 0.0458906, "approximatif : centre code Plus, entrée à vérifier", "Fiche établissement / code Plus", "centre de cellule code Plus"],
  [41, "شاطئ وريعة", "Plage Ouréah", "Plage", "Mazagran", 35.87028, 0.03299, publicStatus, mapcartaSource, "Plage Oureah (polygone OSM) ; pas une entrée routière vérifiée"],
  [43, "شاطئ سيدي المجدوب", "Plage Sidi Medjdoub", "Plage", "Mostaganem", 35.96533, 0.09296, publicStatus, mapcartaSource, "Site touristique Sidi Medjdoub (point OSM) ; pas une entrée routière vérifiée"],
  [47, "شاطئ الميناء الصغير", "Plage Petit Port", "Plage", "Sidi Lakhdar", 36.21042, 0.39363, publicStatus, mapcartaSource, "Plage Petit Port (polygone OSM) ; pas une entrée routière vérifiée"],
  [66, "ملعب محمد بن سعيد", "Stade Mohamed Bensaïd", "Stade", "Mostaganem", 35.92377, 0.10547, sourcedStatus, geographicSource, "OSM way 189535565 ; centre du stade"],
  [72, "ولاية مستغانم", "Wilaya de Mostaganem", "Administration", "Mostaganem", 35.9253125, 0.0820625, plusStatus, "business listing: WILAYA DE MOSTAGANEM", plusPrecision],
  [74, "دائرة مستغانم", "Daïra de Mostaganem", "Administration", "Mostaganem", 35.9229375, 0.0743125, plusStatus, "business listing: Daira De Mostaganem", plusPrecision],
  [76, "محكمة مستغانم", "Tribunal de Mostaganem", "Justice", "Mostaganem", 35.91976, 0.07728, sourcedStatus, geographicSource, "OSM node 13226728372"],
  [93, "ميناء مستغانم", "Port de Mostaganem", "Port", "Mostaganem", 35.93886, 0.08182, publicStatus, mapcartaSource, "Port de Mostaganem (point GeoNames) ; pas une entrée routière vérifiée"],
  [116, "حلويات مونة", "Mouna Pâtisserie", "Pâtisserie", "Mostaganem", 35.9194079, 0.0757359, sourcedStatus, geographicSource, "fiche commerciale ; autre lieu homonyme OSM à 35.93493,0.11045 ; vérifier"],
  [120, "هابي آيس", "Happy Ice", "Café / pâtisserie", "Mostaganem", 35.9144375, 0.0564375, plusStatus, "business listing: Happy Ice - Pastery", plusPrecision],
  [123, "بيتزا لو فايف", "Pizzeria Le Five", "Pizzeria", "Mostaganem", 35.9144375, 0.0899375, plusStatus, "https://es.restaurantguru.com/Le-five-pizza-Mostaganem", plusPrecision],
  [167, "مركز أونو التجاري", "Centre commercial UNO", "Centre commercial", "Route de Relizane, Mostaganem", 35.8998532, 0.1214541, sourcedStatus, "https://www.afrorate.com/listing/centre-commercial-et-de-loisirs-uno-mostaganem/", "point géographique approximatif"],
  [168, "فندق كوت ويست", "Hôtel Côte Ouest", "Hôtel", "Sablettes, Mazagran", 35.8916875, 0.0485625, sourcedStatus, "business listing: Hotel Cote Ouest", "point géographique approximatif"],
  [169, "بيتزا السلامندر", "Pizzeria La Salamandre", "Restaurant", "Mostaganem", 35.9189375, 0.0615625, sourcedStatus, "business listing: Pizzeria La Salamandre", "point géographique approximatif"],
  [170, "مديرية البريد", "Direction postale de Mostaganem", "Administration", "Mostaganem", 35.9283125, 0.0959375, sourcedStatus, "business listing: DUPW Mostaganem", "point géographique approximatif"],
  [171, "الخروبة", "Kharrouba", "Quartier", "Mostaganem", 35.96496, 0.09403, publicStatus, "https://mapcarta.com/17329796 (GeoNames 2492059)", "centre de la localité ; accès routier à confirmer"],
  [172, "كارنتيكا كحلة 1", "Karantika Kahla 1", "Restaurant", "Mostaganem", 35.9319183, 0.1112622, publicStatus, "Google Maps : Karantika Kahla 1 (W4J6+RF2)", "position indiquée sur la carte fournie ; entrée routière à confirmer"],
];

// Lieux fournis pour Mostaganem (WGS84). Les repères et leurs accès restent à vérifier.
const mostaganemPlaces = [
  [1, "تيجديت", "Tijditt", 35.93796, 0.08975, "localite"],
  [2, "المطمر", "Matemore", 35.93433, 0.09366, "localite"],
  [3, "العرصة", "El Arsa", 35.93528, 0.09789, "repere_station_tramway"],
  [4, "الحرية", "El Houria", 35.92595, 0.08595, "repere_mosquee"],
  [5, "الحشم", "Hachem Fouaga", 35.97185, 0.12007, "localite"],
  [6, "300 مسكن", "Cité 300 LPP - Mezaghrane", 35.90209, 0.06311, "cite_identifiee"],
  [7, "600 مسكن", "Cité 600 - Kharrouba", 35.97537, 0.10938, "cite_identifiee"],
  [8, "400 مسكن", "Cité 400 Logements", 35.92704, 0.07846, "cite_identifiee"],
  [9, "طريق وهران", "Route d’Oran", 35.9179, 0.0753, "repere_sur_route"],
  [10, "زغلول", "Zaghloul", 35.92313, 0.09035, "repere_ecole"],
  [11, "صابلات", "Les Sablettes", 35.89533, 0.04759, "localite"],
  [12, "صلامندر", "Salamandre", 35.92189, 0.06046, "localite"],
  [13, "دبدابة", "Debdab", 35.90776, 0.12253, "localite"],
  [14, "سيدي فلاق", "Douar Sidi Fellag", 35.93042, 0.14025, "localite"],
  [15, "سيدي عثمان", "Sidi Othmane", 35.94309, 0.12198, "repere_sanctuaire"],
  [16, "ولاد حمو", "Douar Ouled Hamou", 35.95061, 0.17289, "localite"],
  [17, "348 مسكن", "Cité 348 Logements", 35.9566, 0.1027, "repere_mosquee_ennour"],
  [18, "بيبينيار", "Pépinière", 35.92666, 0.08465, "repere_bureau_poste"],
  [19, "موشتي", "Mouchti", 35.926105, 0.113086, "repere_cite_160_logements"],
  [20, "جامعة مستغانم ITA", "Université de Mostaganem - ITA", 35.93256, 0.0876, "campus"],
  [21, "كلية الطب", "Faculté de médecine", 35.96405, 0.10567, "campus"],
  [22, "كلية الحقوق", "Faculté de droit", 35.9214, 0.06275, "campus"],
  [23, "كلية العلوم الدقيقة والإعلام الآلي", "Faculté des sciences exactes et informatique", 35.91516, 0.0885, "campus"],
  [24, "كلية العلوم الاقتصادية", "Faculté des sciences économiques", 35.98235, 0.11108, "campus"],
  [25, "قسم الهندسة المعمارية", "Département d’architecture", 35.93922, 0.11373, "campus"],
  [26, "صيادة", "Sayada", 35.95097, 0.13103, "localite"],
  [27, "الرادار", "Radar", null, null, "inconnu"],
  [28, "حي الوئام", "El Wiam", null, null, "inconnu"],
  [29, "مونبليزير", "Montplaisir", null, null, "inconnu"],
  [30, "بالفودار", "Belfoudar", null, null, "inconnu"],
  [31, "برايس", "Brais", null, null, "inconnu"],
  [32, "سوق الليل", "Souk Ellil", null, null, "inconnu"],
  [33, "مونادور", "Monador", null, null, "inconnu"],
];

export const destinations = [
  ...communes.map(([id, ar, fr, lat, lng]) => [id, ar, fr, "Commune", fr, lat, lng,
    "coordonnée de référence communale ; non adaptée au routage",
    "riadh2002/algeria-69-wilayas-1541-communes (MIT)", "point de commune, entrée routière non vérifiée"]),
  ...places,
].map(([id, name_ar, name_fr, category, commune_secteur, latitude, longitude, gps_status, source_gps, precision_gps]) => ({
  id, search_name: `${name_ar} - ${name_fr}`, name_ar, name_fr, category,
  category_ar: categoryLabels[category] || category,
  commune_secteur,
  commune_secteur_ar: communes.find(([, , fr]) => fr === commune_secteur)?.[1]
    || ({ Mostaland: "موستالاند", "Sablettes, Mazagran": "الصابلات، مزغران",
      "Route de Relizane, Mostaganem": "طريق غليزان، مستغانم" })[commune_secteur]
    || commune_secteur,
  latitude, longitude, gps_status, source_gps, precision_gps,
  position_gps: latitude == null || longitude == null ? "" : `${latitude}, ${longitude}`,
})).concat(mostaganemPlaces.map(([id, name_ar, name_fr, latitude, longitude, type_position]) => {
  const hasCoordinates = latitude != null && longitude != null;
  const category = type_position === "localite" ? "Quartier"
    : type_position === "cite_identifiee" ? "Cité"
      : type_position === "campus" ? "Campus" : type_position === "inconnu" ? "Lieu" : "Repère";
  return {
    id: `mostaganem:${id}`, search_name: `${name_ar} - ${name_fr}`,
    name_ar, name_fr, category,
    category_ar: ({ Quartier: "حي", Cité: "حي سكني", Campus: "حرم جامعي", Lieu: "مكان", Repère: "معلم" })[category],
    commune_secteur: "Mostaganem", commune_secteur_ar: "مستغانم",
    latitude, longitude, type_position,
    statut_verification: hasCoordinates ? "a_verifier" : "coordonnees_manquantes",
    gps_status: hasCoordinates ? "Coordonnées fournies ; position et accès à vérifier" : "Coordonnées manquantes ; choisir sur la carte",
    source_gps: "Données fournies par l'utilisateur (WGS84 EPSG:4326)",
    precision_gps: hasCoordinates ? type_position.replaceAll("_", " ") : "Point à choisir sur la carte",
    position_gps: hasCoordinates ? `${latitude}, ${longitude}` : "",
  };
})).concat(osmDestinations.map((place) => {
  const name_fr = place.name_fr || place.name;
  const name_ar = place.name_ar;
  const category = ({
    city: "Ville", town: "Ville", village: "Village", hamlet: "Hameau",
    suburb: "Quartier", neighbourhood: "Quartier", quarter: "Quartier", locality: "Localité",
    restaurant: "Restaurant", cafe: "Café", fast_food: "Restauration rapide",
    pharmacy: "Pharmacie", hospital: "Hôpital", clinic: "Clinique", doctors: "Médecin",
    school: "École", university: "Université", post_office: "Bureau de poste",
    police: "Police", bank: "Banque", atm: "Distributeur", fuel: "Station-service",
    hotel: "Hôtel", supermarket: "Supermarché", bakery: "Boulangerie",
    convenience: "Épicerie", clothes: "Vêtements", place_of_worship: "Lieu de culte",
  })[place.category] || place.category.replaceAll("_", " ");
  return {
    id: place.id,
    search_name: name_ar && name_ar !== name_fr ? `${name_ar} - ${name_fr}` : name_fr,
    name_ar, name_fr, category, category_ar: category,
    commune_secteur: place.city || place.street,
    commune_secteur_ar: place.city || place.street,
    latitude: place.latitude, longitude: place.longitude,
    gps_status: "Point OpenStreetMap ; accès routier à vérifier",
    source_gps: `OpenStreetMap ${place.id.slice(4)}`,
    precision_gps: "Point cartographique ; entrée non vérifiée",
    position_gps: `${place.latitude}, ${place.longitude}`,
    search_aliases: [place.name, place.name_ar, place.name_fr, place.city, place.street].filter(Boolean).join(" "),
  };
}));
