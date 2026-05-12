// ============================================================
// MOK TRANSPORTS — booking.js  (v2)
// Features:
//   • Google Places Autocomplete on address fields
//   • Real distance via Google Maps Distance Matrix API
//   • JKJ Pricing matrix (all 5 service tiers)
//   • Service-zone detection (In-City, Intra-Regional, etc.)
//   • Shipment Summary modal before save
//   • Waybill number generation on confirm
//   • LocalStorage handoff to localWaybill.html
// ============================================================

// ----------------------------------------------------------
// 0. GOOGLE API KEY — replace with your own
// ----------------------------------------------------------
const GOOGLE_API_KEY = "AIzaSyBsZik-na0xiGCAdoGfMrvzMhQHOGQjhkM";

// ----------------------------------------------------------
// 1. JKJ PRICING TABLES
//    All prices are per chargeable-kg (rand, incl. 9.5% increase)
//    Weight brackets: 0.5 up to 70 kg — we interpolate for >70 kg
// ----------------------------------------------------------

// Helper: build a weight→price lookup from raw arrays
function buildLookup(weights, ...priceCols) {
  // returns array of { weight, cols:[price0, price1, ...] }
  return weights.map((w, i) => ({ weight: w, prices: priceCols.map(c => c[i]) }));
}

// ---- SameDay Express Air ----
const SAME_DAY_WEIGHTS = [0.5, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48, 49, 50, 51, 52, 53, 54, 55, 56, 57, 58, 59, 60, 61, 62, 63, 64, 65, 66, 67, 68, 69, 70];
const SAME_DAY_MAJOR = [1462.5, 1462.5, 1462.5, 1560, 1657.5, 1755, 1852.5, 1950, 2047.5, 2145, 2242.5, 2340, 2437.5, 2535, 2632.5, 2730, 2827.5, 2925, 3022.5, 3120, 3217.5, 3315, 3412.5, 3510, 3607.5, 3705, 3802.5, 3900, 3997.5, 4095, 4192.5, 4290, 4387.5, 4485, 4582.5, 4680, 4777.5, 4875, 4972.5, 5070, 5167.5, 5265, 5362.5, 5460, 5557.5, 5655, 5752.5, 5850, 5947.5, 6045, 6142.5, 6240, 6337.5, 6435, 6532.5, 6630, 6727.5, 6825, 6922.5, 7020, 7117.5, 7215, 7312.5, 7410, 7507.5, 7605, 7702.5, 7800, 7897.5, 7995, 8092.5];
const SAME_DAY_INCITY_JHB = [780, 780, 780, 783.9, 787.8, 791.7, 795.6, 799.5, 803.4, 807.3, 811.2, 815.1, 819, 822.9, 826.8, 830.7, 834.6, 838.5, 842.4, 846.3, 850.2, 854.1, 858, 861.9, 865.8, 869.7, 873.6, 877.5, 881.4, 885.3, 889.2, 893.1, 897, 900.9, 904.8, 908.7, 912.6, 916.5, 920.4, 924.3, 928.2, 932.1, 936, 939.9, 943.8, 947.7, 951.6, 955.5, 959.4, 963.3, 967.2, 971.1, 975, 978.9, 982.8, 986.7, 990.6, 994.5, 998.4, 1002.3, 1006.2, 1010.1, 1014, 1017.9, 1021.8, 1025.7, 1029.6, 1033.5, 1037.4, 1041.3, 1045.2];
const SAME_DAY_INCITY_PTA = [975, 975, 975, 980.85, 986.7, 992.55, 998.4, 1004.25, 1010.1, 1015.95, 1021.8, 1027.65, 1033.5, 1039.35, 1045.2, 1051.05, 1056.9, 1062.75, 1068.6, 1074.45, 1080.3, 1086.15, 1092, 1097.85, 1103.7, 1109.55, 1115.4, 1121.25, 1127.1, 1132.95, 1138.8, 1144.65, 1150.5, 1156.35, 1162.2, 1168.05, 1173.9, 1179.75, 1185.6, 1191.45, 1197.3, 1203.15, 1209, 1214.85, 1220.7, 1226.55, 1232.4, 1238.25, 1244.1, 1249.95, 1255.8, 1261.65, 1267.5, 1273.35, 1279.2, 1285.05, 1290.9, 1296.75, 1302.6, 1308.45, 1314.3, 1320.15, 1326, 1331.85, 1337.7, 1343.55, 1349.4, 1355.25, 1361.1, 1366.95, 1372.8];

// ---- Overnight Express (ONX) ----
const ONX_WEIGHTS = SAME_DAY_WEIGHTS;
const ONX_INCITY = [117, 117, 117, 122.85, 128.7, 134.55, 140.4, 146.25, 152.1, 157.95, 163.8, 169.65, 175.5, 181.35, 187.2, 193.05, 198.9, 204.75, 210.6, 216.45, 222.3, 228.15, 234, 239.85, 245.7, 251.55, 257.4, 263.25, 269.1, 274.95, 280.8, 286.65, 292.5, 298.35, 304.2, 310.05, 315.9, 321.75, 327.6, 333.45, 339.3, 345.15, 351, 356.85, 362.7, 368.55, 374.4, 380.25, 386.1, 391.95, 397.8, 403.65, 409.5, 415.35, 421.2, 427.05, 432.9, 438.75, 444.6, 450.45, 456.3, 462.15, 468, 473.85, 479.7, 485.55, 491.4, 497.25, 503.1, 508.95, 514.8];
const ONX_INTRA = [156, 156, 156, 185.25, 214.5, 243.75, 273, 302.25, 331.5, 360.75, 390, 419.25, 448.5, 477.75, 507, 536.25, 565.5, 594.75, 624, 653.25, 682.5, 711.75, 741, 770.25, 799.5, 828.75, 858, 887.25, 916.5, 945.75, 975, 1004.25, 1033.5, 1062.75, 1092, 1121.25, 1150.5, 1179.75, 1209, 1238.25, 1267.5, 1296.75, 1326, 1355.25, 1384.5, 1413.75, 1443, 1472.25, 1501.5, 1530.75, 1560, 1589.25, 1618.5, 1647.75, 1677, 1706.25, 1735.5, 1764.75, 1794, 1823.25, 1852.5, 1881.75, 1911, 1940.25, 1969.5, 1998.75, 2028, 2057.25, 2086.5, 2115.75, 2145];
const ONX_MAJ_REG = [370.5, 370.5, 370.5, 487.5, 604.5, 721.5, 838.5, 955.5, 1072.5, 1189.5, 1306.5, 1423.5, 1540.5, 1657.5, 1774.5, 1891.5, 2008.5, 2125.5, 2242.5, 2359.5, 2476.5, 2593.5, 2710.5, 2827.5, 2944.5, 3061.5, 3178.5, 3295.5, 3412.5, 3529.5, 3646.5, 3763.5, 3880.5, 3997.5, 4114.5, 4231.5, 4348.5, 4465.5, 4582.5, 4699.5, 4816.5, 4933.5, 5050.5, 5167.5, 5284.5, 5401.5, 5518.5, 5635.5, 5752.5, 5869.5, 5986.5, 6103.5, 6220.5, 6337.5, 6454.5, 6571.5, 6688.5, 6805.5, 6922.5, 7039.5, 7156.5, 7273.5, 7390.5, 7507.5, 7624.5, 7741.5, 7858.5, 7975.5, 8092.5, 8209.5, 8326.5];
const ONX_REG_REG = [565.5, 565.5, 565.5, 702, 838.5, 975, 1111.5, 1248, 1384.5, 1521, 1657.5, 1794, 1930.5, 2067, 2203.5, 2340, 2476.5, 2613, 2749.5, 2886, 3022.5, 3159, 3295.5, 3432, 3568.5, 3705, 3841.5, 3978, 4114.5, 4251, 4387.5, 4524, 4660.5, 4797, 4933.5, 5070, 5206.5, 5343, 5479.5, 5616, 5752.5, 5889, 6025.5, 6162, 6298.5, 6435, 6571.5, 6708, 6844.5, 6981, 7117.5, 7254, 7390.5, 7527, 7663.5, 7800, 7936.5, 8073, 8209.5, 8346, 8482.5, 8619, 8755.5, 8892, 9028.5, 9165, 9301.5, 9438, 9574.5, 9711, 9847.5];

// ---- NextDay Express ----
const NDD_INCITY = [117, 117, 117, 117, 117, 117, 136.5, 156, 175.5, 195, 214.5, 234, 253.5, 273, 292.5, 312, 331.5, 351, 370.5, 390, 409.5, 429, 448.5, 468, 487.5, 507, 526.5, 546, 565.5, 585, 604.5, 624, 643.5, 663, 682.5, 702, 721.5, 741, 760.5, 780, 799.5, 819, 838.5, 858, 877.5, 897, 916.5, 936, 955.5, 975, 994.5, 1014, 1033.5, 1053, 1072.5, 1092, 1111.5, 1131, 1150.5, 1170, 1189.5, 1209, 1228.5, 1248, 1267.5, 1287, 1306.5, 1326, 1345.5, 1365, 1384.5];
const NDD_MAJOR = [175.5, 175.5, 175.5, 175.5, 175.5, 175.5, 195, 214.5, 234, 253.5, 273, 292.5, 312, 331.5, 351, 370.5, 390, 409.5, 429, 448.5, 468, 487.5, 507, 526.5, 546, 565.5, 585, 604.5, 624, 643.5, 663, 682.5, 702, 721.5, 741, 760.5, 780, 799.5, 819, 838.5, 858, 877.5, 897, 916.5, 936, 955.5, 975, 994.5, 1014, 1033.5, 1053, 1072.5, 1092, 1111.5, 1131, 1150.5, 1170, 1189.5, 1209, 1228.5, 1248, 1267.5, 1287, 1306.5, 1326, 1345.5, 1365, 1384.5, 1404, 1423.5, 1443];
const NDD_INTRA = [156, 156, 156, 156, 156, 156, 185.25, 214.5, 243.75, 273, 302.25, 331.5, 360.75, 390, 419.25, 448.5, 477.75, 507, 536.25, 565.5, 594.75, 624, 653.25, 682.5, 711.75, 741, 770.25, 799.5, 828.75, 858, 887.25, 916.5, 945.75, 975, 1004.25, 1033.5, 1062.75, 1092, 1121.25, 1150.5, 1179.75, 1209, 1238.25, 1267.5, 1296.75, 1326, 1355.25, 1384.5, 1413.75, 1443, 1472.25, 1501.5, 1530.75, 1560, 1589.25, 1618.5, 1647.75, 1677, 1706.25, 1735.5, 1764.75, 1794, 1823.25, 1852.5, 1881.75, 1911, 1940.25, 1969.5, 1998.75, 2028, 2057.25];
const NDD_INLAND = [370.5, 370.5, 370.5, 370.5, 370.5, 370.5, 487.5, 604.5, 721.5, 838.5, 955.5, 1072.5, 1189.5, 1306.5, 1423.5, 1540.5, 1657.5, 1774.5, 1891.5, 2008.5, 2125.5, 2242.5, 2359.5, 2476.5, 2593.5, 2710.5, 2827.5, 2944.5, 3061.5, 3178.5, 3295.5, 3412.5, 3529.5, 3646.5, 3763.5, 3880.5, 3997.5, 4114.5, 4231.5, 4348.5, 4465.5, 4582.5, 4699.5, 4816.5, 4933.5, 5050.5, 5167.5, 5284.5, 5401.5, 5518.5, 5635.5, 5752.5, 5869.5, 5986.5, 6103.5, 6220.5, 6337.5, 6454.5, 6571.5, 6688.5, 6805.5, 6922.5, 7039.5, 7156.5, 7273.5, 7390.5, 7507.5, 7624.5, 7741.5, 7858.5, 7975.5];
const NDD_REG = [565.5, 565.5, 565.5, 565.5, 565.5, 565.5, 702, 838.5, 975, 1111.5, 1248, 1384.5, 1521, 1657.5, 1794, 1930.5, 2067, 2203.5, 2340, 2476.5, 2613, 2749.5, 2886, 3022.5, 3159, 3295.5, 3432, 3568.5, 3705, 3841.5, 3978, 4114.5, 4251, 4387.5, 4524, 4660.5, 4797, 4933.5, 5070, 5206.5, 5343, 5479.5, 5616, 6162, 6298.5, 6435, 6571.5, 6708, 6844.5, 6981, 7117.5, 7254, 7390.5, 7527, 7663.5, 7800, 7936.5, 8073, 8209.5, 8346, 8482.5, 8619, 8755.5, 8892, 9028.5, 9165, 9301.5, 9438];

// ---- Economy Service (ECO) ----
const ECO_INCITY = [156, 156, 156, 156, 156, 156, 156, 156, 156, 156, 156, 159.9, 163.8, 167.7, 171.6, 175.5, 179.4, 183.3, 187.2, 191.1, 195, 198.9, 202.8, 206.7, 210.6, 214.5, 218.4, 222.3, 226.2, 230.1, 234, 237.9, 241.8, 245.7, 249.6, 253.5, 257.4, 261.3, 265.2, 269.1, 273, 276.9, 280.8, 284.7, 288.6, 292.5, 296.4, 300.3, 304.2, 308.1, 312, 315.9, 319.8, 323.7, 327.6, 331.5, 335.4, 339.3, 343.2, 347.1, 351, 354.9, 358.8, 362.7, 366.6, 370.5, 374.4, 378.3, 382.2, 386.1, 390];
const ECO_MAJOR = [234, 234, 234, 234, 234, 234, 234, 234, 234, 234, 234, 245.7, 257.4, 269.1, 280.8, 292.5, 304.2, 315.9, 327.6, 339.3, 351, 362.7, 374.4, 386.1, 397.8, 409.5, 421.2, 432.9, 444.6, 456.3, 468, 479.7, 491.4, 503.1, 514.8, 526.5, 538.2, 549.9, 561.6, 573.3, 585, 596.7, 608.4, 620.1, 631.8, 643.5, 655.2, 666.9, 678.6, 690.3, 702, 713.7, 725.4, 737.1, 748.8, 760.5, 772.2, 783.9, 795.6, 807.3, 819, 830.7, 842.4, 854.1, 865.8, 877.5, 889.2, 900.9, 912.6, 924.3, 936];
const ECO_INTRA = [175.5, 175.5, 175.5, 175.5, 175.5, 175.5, 175.5, 175.5, 175.5, 175.5, 175.5, 189.15, 202.8, 216.45, 230.1, 243.75, 257.4, 271.05, 284.7, 298.35, 312, 325.65, 339.3, 352.95, 366.6, 380.25, 393.9, 407.55, 421.2, 434.85, 448.5, 462.15, 475.8, 489.45, 503.1, 516.75, 530.4, 544.05, 557.7, 571.35, 585, 598.65, 612.3, 625.95, 639.6, 653.25, 666.9, 680.55, 694.2, 707.85, 721.5, 735.15, 748.8, 762.45, 776.1, 789.75, 803.4, 817.05, 830.7, 844.35, 858, 871.65, 885.3, 898.95, 912.6, 926.25, 939.9, 953.55, 967.2, 980.85, 994.5];
const ECO_REG = [292.5, 292.5, 292.5, 292.5, 292.5, 292.5, 292.5, 292.5, 292.5, 292.5, 292.5, 306.15, 319.8, 333.45, 347.1, 360.75, 374.4, 388.05, 401.7, 415.35, 429, 442.65, 456.3, 469.95, 483.6, 497.25, 510.9, 524.55, 538.2, 551.85, 565.5, 579.15, 592.8, 606.45, 620.1, 633.75, 647.4, 661.05, 674.7, 688.35, 702, 715.65, 729.3, 742.95, 756.6, 770.25, 783.9, 797.55, 811.2, 824.85, 838.5, 852.15, 865.8, 879.45, 893.1, 906.75, 920.4, 934.05, 947.7, 961.35, 975, 988.65, 1002.3, 1015.95, 1029.6, 1043.25, 1056.9, 1070.55, 1084.2, 1097.85, 1111.5];
const ECO_REG2 = [390, 390, 390, 390, 390, 390, 390, 390, 390, 390, 390, 409.5, 429, 448.5, 468, 487.5, 507, 526.5, 546, 565.5, 585, 604.5, 624, 643.5, 663, 682.5, 702, 721.5, 741, 760.5, 780, 799.5, 819, 838.5, 858, 877.5, 897, 916.5, 936, 955.5, 975, 994.5, 1014, 1033.5, 1053, 1072.5, 1092, 1111.5, 1131, 1150.5, 1170, 1189.5, 1209, 1228.5, 1248, 1267.5, 1287, 1306.5, 1326, 1345.5, 1365, 1384.5, 1404, 1423.5, 1443, 1462.5, 1482, 1501.5, 1521, 1540.5, 1560];

// ---- Economy Special (city codes) ----
const ECO_SP_WEIGHTS = SAME_DAY_WEIGHTS;
const ECO_SP = {
  GRJ: [214.5, 214.5, 214.5, 214.5, 214.5, 214.5, 214.5, 214.5, 214.5, 214.5, 214.5, 228.15, 241.8, 255.45, 269.1, 282.75, 296.4, 310.05, 323.7, 337.35, 351, 364.65, 378.3, 391.95, 405.6, 419.25, 432.9, 446.55, 460.2, 473.85, 487.5, 501.15, 514.8, 528.45, 542.1, 555.75, 569.4, 583.05, 596.7, 610.35, 624, 637.65, 651.3, 664.95, 678.6, 692.25, 705.9, 719.55, 733.2, 746.85, 760.5, 774.15, 787.8, 801.45, 815.1, 828.75, 842.4, 856.05, 869.7, 883.35, 897, 910.65, 924.3, 937.95, 951.6, 965.25, 978.9, 992.55, 1006.2, 1019.85, 1033.5],
  CPT: [195, 195, 195, 195, 195, 195, 195, 195, 195, 195, 195, 204.75, 214.5, 224.25, 234, 243.75, 253.5, 263.25, 273, 282.75, 292.5, 302.25, 312, 321.75, 331.5, 341.25, 351, 360.75, 370.5, 380.25, 390, 399.75, 409.5, 419.25, 429, 438.75, 448.5, 458.25, 468, 477.75, 487.5, 497.25, 507, 516.75, 526.5, 536.25, 546, 555.75, 565.5, 575.25, 585, 594.75, 604.5, 614.25, 624, 633.75, 643.5, 653.25, 663, 672.75, 682.5, 692.25, 702, 711.75, 721.5, 731.25, 741, 750.75, 760.5, 770.25, 780],
  DUR: [195, 195, 195, 195, 195, 195, 195, 195, 195, 195, 195, 200.85, 206.7, 212.55, 218.4, 224.25, 230.1, 235.95, 241.8, 247.65, 253.5, 259.35, 265.2, 271.05, 276.9, 282.75, 288.6, 294.45, 300.3, 306.15, 312, 317.85, 323.7, 329.55, 335.4, 341.25, 347.1, 352.95, 358.8, 364.65, 370.5, 376.35, 382.2, 388.05, 393.9, 399.75, 405.6, 411.45, 417.3, 423.15, 429, 434.85, 440.7, 446.55, 452.4, 458.25, 464.1, 469.95, 475.8, 481.65, 487.5, 493.35, 499.2, 505.05, 510.9, 516.75, 522.6, 528.45, 534.3, 540.15, 546],
  EL: [214.5, 214.5, 214.5, 214.5, 214.5, 214.5, 214.5, 214.5, 214.5, 214.5, 214.5, 226.2, 237.9, 249.6, 261.3, 273, 284.7, 296.4, 308.1, 319.8, 331.5, 343.2, 354.9, 366.6, 378.3, 390, 401.7, 413.4, 425.1, 436.8, 448.5, 460.2, 471.9, 483.6, 495.3, 507, 518.7, 530.4, 542.1, 553.8, 565.5, 577.2, 588.9, 600.6, 612.3, 624, 635.7, 647.4, 659.1, 670.8, 682.5, 694.2, 705.9, 717.6, 729.3, 741, 752.7, 764.4, 776.1, 787.8, 799.5, 811.2, 822.9, 834.6, 846.3, 858, 869.7, 881.4, 893.1, 904.8, 916.5],
  BFN: [195, 195, 195, 195, 195, 195, 195, 195, 195, 195, 195, 199.875, 204.75, 209.625, 214.5, 219.375, 224.25, 229.125, 234, 238.875, 243.75, 248.625, 253.5, 258.375, 263.25, 268.125, 273, 277.875, 282.75, 287.625, 292.5, 297.375, 302.25, 307.125, 312, 316.875, 321.75, 326.625, 331.5, 336.375, 341.25, 346.125, 351, 355.875, 360.75, 365.625, 370.5, 375.375, 380.25, 385.125, 390, 394.875, 399.75, 404.625, 409.5, 414.375, 419.25, 424.125, 429, 433.875, 438.75, 443.625, 448.5, 453.375, 458.25, 463.125, 468, 472.875, 477.75, 482.625, 487.5],
  PTG: [175.5, 175.5, 175.5, 175.5, 175.5, 175.5, 175.5, 175.5, 175.5, 175.5, 175.5, 179.4, 183.3, 187.2, 191.1, 195, 198.9, 202.8, 206.7, 210.6, 214.5, 218.4, 222.3, 226.2, 230.1, 234, 237.9, 241.8, 245.7, 249.6, 253.5, 257.4, 261.3, 265.2, 269.1, 273, 276.9, 280.8, 284.7, 288.6, 292.5, 296.4, 300.3, 304.2, 308.1, 312, 315.9, 319.8, 323.7, 327.6, 331.5, 335.4, 339.3, 343.2, 347.1, 351, 354.9, 358.8, 362.7, 366.6, 370.5, 374.4, 378.3, 382.2, 386.1, 390, 393.9, 397.8, 401.7, 405.6, 409.5],
  REGPTG: [234, 234, 234, 234, 234, 234, 234, 234, 234, 234, 234, 239.85, 245.7, 251.55, 257.4, 263.25, 269.1, 274.95, 280.8, 286.65, 292.5, 298.35, 304.2, 310.05, 315.9, 321.75, 327.6, 333.45, 339.3, 345.15, 351, 356.85, 362.7, 368.55, 374.4, 380.25, 386.1, 391.95, 397.8, 403.65, 409.5, 415.35, 421.2, 427.05, 432.9, 438.75, 444.6, 450.45, 456.3, 462.15, 468, 473.85, 479.7, 485.55, 491.4, 497.25, 503.1, 508.95, 514.8, 520.65, 526.5, 532.35, 538.2, 544.05, 549.9, 555.75, 561.6, 567.45, 573.3, 579.15, 585],
  KIM: [195, 195, 195, 195, 195, 195, 195, 195, 195, 195, 195, 202.8, 210.6, 218.4, 226.2, 234, 241.8, 249.6, 257.4, 265.2, 273, 280.8, 288.6, 296.4, 304.2, 312, 319.8, 327.6, 335.4, 343.2, 351, 358.8, 366.6, 374.4, 382.2, 390, 397.8, 405.6, 413.4, 421.2, 429, 436.8, 444.6, 452.4, 460.2, 468, 475.8, 483.6, 491.4, 499.2, 507, 514.8, 522.6, 530.4, 538.2, 546, 553.8, 561.6, 569.4, 577.2, 585, 592.8, 600.6, 608.4, 616.2, 624, 631.8, 639.6, 647.4, 655.2, 663]
};

// ----------------------------------------------------------
// 2. ZONE DETECTION
//    Based on Google Places address_components or simple keyword matching
// ----------------------------------------------------------
const JHB_KEYWORDS = ["johannesburg", "sandton", "soweto", "roodepoort", "midrand", "randburg", "edenvale", "germiston", "alberton", "boksburg", "kempton", "benoni", "springs", "brakpan", "nigel", "krugersdorp", "randfontein", "westonaria"];
const PTA_KEYWORDS = ["pretoria", "centurion", "tshwane", "soshanguve", "mamelodi", "atteridgeville", "bronkhorstspruit"];
const MAJOR_KEYWORDS = ["cape town", "durban", "port elizabeth", "gqeberha", "bloemfontein", "east london", "polokwane", "nelspruit", "mbombela", "kimberley", "george", "pietermaritzburg", "rustenburg", "witbank", "emalahleni", "klerksdorp", "vereeniging", "vanderbijlpark"];
const GRJ_KEYWORDS = ["george", "knysna", "mossel bay", "oudtshoorn"];
const CPT_KEYWORDS = ["cape town", "stellenbosch", "paarl", "bellville", "somerset west", "worcester"];
const DUR_KEYWORDS = ["durban", "pietermaritzburg", "pmb", "pinetown", "chatsworth", "amanzimtoti"];
const EL_KEYWORDS = ["east london"];
const BFN_KEYWORDS = ["bloemfontein", "welkom", "virginia", "odendaalsrus"];
const PTG_KEYWORDS = ["polokwane", "lephalale", "mokopane", "bela-bela"];
const KIM_KEYWORDS = ["kimberley", "de aar", "upington", "springbok"];

function detectZone(address) {
  const a = (address || "").toLowerCase();
  if (JHB_KEYWORDS.some(k => a.includes(k))) return "JHB";
  if (PTA_KEYWORDS.some(k => a.includes(k))) return "PTA";
  if (GRJ_KEYWORDS.some(k => a.includes(k))) return "GRJ";
  if (CPT_KEYWORDS.some(k => a.includes(k))) return "CPT";
  if (DUR_KEYWORDS.some(k => a.includes(k))) return "DUR";
  if (EL_KEYWORDS.some(k => a.includes(k))) return "EL";
  if (BFN_KEYWORDS.some(k => a.includes(k))) return "BFN";
  if (PTG_KEYWORDS.some(k => a.includes(k))) return "PTG";
  if (KIM_KEYWORDS.some(k => a.includes(k))) return "KIM";
  if (MAJOR_KEYWORDS.some(k => a.includes(k))) return "MAJOR";
  return "REGIONAL";
}

// ----------------------------------------------------------
// 3. PRICE LOOKUP
//    Given chargeable weight, service, from-zone, to-zone → price (ZAR)
// ----------------------------------------------------------
function interpolatePrice(weightArr, priceArr, chargeable) {
  if (chargeable <= weightArr[0]) return priceArr[0];
  if (chargeable >= weightArr[weightArr.length - 1]) {
    // extrapolate linearly from last two points
    const n = weightArr.length - 1;
    const rate = (priceArr[n] - priceArr[n - 1]) / (weightArr[n] - weightArr[n - 1]);
    return priceArr[n] + rate * (chargeable - weightArr[n]);
  }
  for (let i = 1; i < weightArr.length; i++) {
    if (chargeable <= weightArr[i]) {
      const t = (chargeable - weightArr[i - 1]) / (weightArr[i] - weightArr[i - 1]);
      return priceArr[i - 1] + t * (priceArr[i] - priceArr[i - 1]);
    }
  }
  return 0;
}

function getZoneCategory(fromZone, toZone) {
  // Returns a string describing the route type
  const inCity = (z) => z === "JHB" || z === "PTA";
  const major = (z) => z === "JHB" || z === "PTA" || z === "MAJOR" || z === "CPT" || z === "DUR";
  const special = ["GRJ", "CPT", "DUR", "EL", "BFN", "PTG", "KIM", "REGPTG"];

  if (inCity(fromZone) && inCity(toZone)) return "IN_CITY";
  if (major(fromZone) && major(toZone)) return "MAJOR";
  if ((major(fromZone) && !major(toZone)) || (!major(fromZone) && major(toZone))) return "MAJ_REG";
  return "REG_REG";
}

function calculatePrice(service, chargeable, fromAddress, toAddress) {
  const fromZone = detectZone(fromAddress);
  const toZone = detectZone(toAddress);
  const category = getZoneCategory(fromZone, toZone);

  let priceArr, label;

  switch (service) {
    case "SAMEDAY":
      if (category === "IN_CITY") {
        if (fromZone === "PTA" || toZone === "PTA") {
          priceArr = SAME_DAY_INCITY_PTA; label = "In-City JHB–PTA";
        } else {
          priceArr = SAME_DAY_INCITY_JHB; label = "In-City JHB–JHB";
        }
      } else {
        priceArr = SAME_DAY_MAJOR; label = "Major Centres";
      }
      return { price: interpolatePrice(SAME_DAY_WEIGHTS, priceArr, chargeable), label };

    case "ONX":
      if (category === "IN_CITY") { priceArr = ONX_INCITY; label = "In-City"; }
      else if (category === "MAJOR") { priceArr = ONX_INTRA; label = "Intra-Regional"; }
      else if (category === "MAJ_REG") { priceArr = ONX_MAJ_REG; label = "Major to Regional"; }
      else { priceArr = ONX_REG_REG; label = "Reg-to-Reg"; }
      return { price: interpolatePrice(ONX_WEIGHTS, priceArr, chargeable), label };

    case "NDD":
      if (category === "IN_CITY") { priceArr = NDD_INCITY; label = "In-City"; }
      else if (category === "MAJOR") { priceArr = NDD_MAJOR; label = "Major (DBN)"; }
      else if (category === "MAJ_REG") { priceArr = NDD_INTRA; label = "Intra-Regional"; }
      else if (toZone === "REGIONAL" || fromZone === "REGIONAL") { priceArr = NDD_INLAND; label = "Inland Regional"; }
      else { priceArr = NDD_REG; label = "Reg-to-Reg"; }
      return { price: interpolatePrice(SAME_DAY_WEIGHTS, priceArr, chargeable), label };

    case "ECO": {
      const specialZones = ["GRJ", "CPT", "DUR", "EL", "BFN", "PTG", "KIM"];
      const destSpecial = specialZones.includes(toZone) ? toZone : null;
      const origSpecial = specialZones.includes(fromZone) ? fromZone : null;
      const sp = destSpecial || origSpecial;
      if (sp && ECO_SP[sp]) {
        return { price: interpolatePrice(ECO_SP_WEIGHTS, ECO_SP[sp], chargeable), label: `Economy Special → ${sp}` };
      }
      if (category === "IN_CITY") { priceArr = ECO_INCITY; label = "In-City"; }
      else if (category === "MAJOR") { priceArr = ECO_MAJOR; label = "Major-Major"; }
      else if (category === "MAJ_REG") { priceArr = ECO_INTRA; label = "Intra-Regional"; }
      else { priceArr = ECO_REG2; label = "Reg-to-Reg"; }
      return { price: interpolatePrice(SAME_DAY_WEIGHTS, priceArr, chargeable), label };
    }

    default:
      return { price: 0, label: "—" };
  }
}

// ----------------------------------------------------------
// 4. WAYBILL NUMBER GENERATOR — sequential MOK000001, MOK000002 …
// ----------------------------------------------------------
function generateWaybillNumber() {
  const current = parseInt(localStorage.getItem("mokWaybillCounter") || "0", 10);
  const next = current + 1;
  localStorage.setItem("mokWaybillCounter", String(next));
  return `MOK${String(next).padStart(6, "0")}`;
}

// ----------------------------------------------------------
// 5. TABLE ROW MANAGEMENT
// ----------------------------------------------------------
function addRow() {
  const table = document.getElementById("shipmentTable");
  const row = document.createElement("tr");
  row.innerHTML = `
    <td><input type="number" value="1" min="1" class="qty"></td>
    <td><input type="text" class="desc-input"></td>
    <td><input type="number" class="weight" oninput="calculateAll()" step="0.1" min="0"></td>
    <td>
      <button type="button" class="btn red btn-small" onclick="removeRow(this)">
        <i class="material-icons">delete</i>
      </button>
    </td>
  `;
  table.appendChild(row);
}

function removeRow(btn) {
  btn.closest("tr").remove();
  calculateAll();
}

// ----------------------------------------------------------
// 6. WEIGHT & PRICE CALCULATION
// ----------------------------------------------------------
function calculateAll() {
  let totalWeight = 0;
  document.querySelectorAll(".weight").forEach(w => {
    totalWeight += Number(w.value) || 0;
  });

  const L = Number(document.getElementById("length").value) || 0;
  const W = Number(document.getElementById("width").value) || 0;
  const H = Number(document.getElementById("height").value) || 0;
  const volumetric = (L * W * H) / 5000;
  const chargeable = Math.max(totalWeight, volumetric);

  const service = document.getElementById("serviceType").value;
  const fromAddress = document.getElementById("fromAddress").value;
  const toAddress = document.getElementById("toAddress").value;

  const { price, label } = calculatePrice(service, chargeable, fromAddress, toAddress);

  document.getElementById("actualWeight").innerText = totalWeight.toFixed(2);
  document.getElementById("volWeight").innerText = volumetric.toFixed(2);
  document.getElementById("chargeWeight").innerText = chargeable.toFixed(2);
  document.getElementById("price").innerText = price.toFixed(2);
  document.getElementById("zoneLabel").innerText = label || "—";

  // Store for summary
  window._lastCalc = { totalWeight, volumetric, chargeable, price, label, service };
}

// ----------------------------------------------------------
// 7. GOOGLE PLACES AUTOCOMPLETE
// ----------------------------------------------------------
let autocompleteFrom, autocompleteTo;

function initAutocomplete() {
  const options = {
    componentRestrictions: { country: "za" },
    fields: ["formatted_address", "geometry", "name", "address_components"]
  };

  autocompleteFrom = new google.maps.places.Autocomplete(
    document.getElementById("fromAddress"), options
  );
  autocompleteTo = new google.maps.places.Autocomplete(
    document.getElementById("toAddress"), options
  );

  autocompleteFrom.addListener("place_changed", () => {
    const place = autocompleteFrom.getPlace();
    if (place.formatted_address) {
      fillAddressComponents(place.address_components, "from");
      calculateDistance();
    }
  });

  autocompleteTo.addListener("place_changed", () => {
    const place = autocompleteTo.getPlace();
    if (place.formatted_address) {
      fillAddressComponents(place.address_components, "to");
      calculateDistance();
    }
  });
}

function fillAddressComponents(components, prefix) {
  if (!components) return;
  const get = (types) => {
    const c = components.find(c => types.some(t => c.types.includes(t)));
    return c ? c.long_name : "";
  };
  const streetNo = get(["street_number"]);
  const streetName = get(["route"]);
  const suburb = get(["sublocality", "sublocality_level_1", "neighborhood"]);
  const town = get(["locality", "administrative_area_level_2"]);
  const postal = get(["postal_code"]);

  const streetField = document.getElementById(`${prefix}Address`);
  const suburbField = document.getElementById(`${prefix}Suburb`);
  const townField = document.getElementById(`${prefix}Town`);
  const postalField = document.getElementById(`${prefix}Postal`);

  if (streetField) {
    streetField.value = [streetNo, streetName].filter(Boolean).join(" ");
    M.updateTextFields();
  }
  if (suburbField && suburb) { suburbField.value = suburb; M.updateTextFields(); }
  if (townField && town) { townField.value = town; M.updateTextFields(); }
  if (postalField && postal) { postalField.value = postal; M.updateTextFields(); }
}

// ----------------------------------------------------------
// 8. DISTANCE MATRIX (real Google API)
// ----------------------------------------------------------
function calculateDistance() {
  const fromMain = document.getElementById("fromAddress").value;
  const toMain = document.getElementById("toAddress").value;

  // Get Town/Suburb as fallbacks
  const fromTown = document.getElementById("fromTown")?.value || "";
  const toTown = document.getElementById("toTown")?.value || "";

  // Create a more specific string for the API
  const origin = fromMain.includes(fromTown) ? fromMain : `${fromMain}, ${fromTown}, ZA`;
  const destination = toMain.includes(toTown) ? toMain : `${toMain}, ${toTown}, ZA`;

  if (!fromMain || !toMain) return;

  const service = new google.maps.DistanceMatrixService();
  service.getDistanceMatrix({
    origins: [origin],
    destinations: [destination],
    travelMode: google.maps.TravelMode.DRIVING,
    unitSystem: google.maps.UnitSystem.METRIC
  }, (response, status) => {
    if (status === "OK") {
      const element = response.rows[0].elements[0];
      if (element.status === "OK") {
        const distKm = Math.round(element.distance.value / 1000);
        document.getElementById("distance").innerText = distKm;
      } else {
        console.error("Distance Matrix Element Error:", element.status); // Check console for "ZERO_RESULTS" or "NOT_FOUND"
        document.getElementById("distance").innerText = "N/A";
      }
    } else {
      console.error("Distance Matrix API Error:", status);
      document.getElementById("distance").innerText = "N/A";
    }
    calculateAll();
  });
}

// ----------------------------------------------------------
// 9. COLLECT BOOKING DATA
// ----------------------------------------------------------
function collectBookingData() {
  const rows = document.querySelectorAll("#shipmentTable tr");
  const items = Array.from(rows).map(r => {
    const inputs = r.querySelectorAll("input");
    return {
      qty: inputs[0] ? inputs[0].value : "",
      desc: inputs[1] ? inputs[1].value : "",
      weight: inputs[2] ? inputs[2].value : ""
    };
  });

  const totalPieces = Array.from(rows).reduce((s, r) => {
    const q = r.querySelectorAll("input")[0];
    return s + (Number(q ? q.value : 0) || 0);
  }, 0);

  const descriptions = items.map(i => i.desc).filter(Boolean).join(", ");

  return {
    shipmentDate: document.getElementById("shipmentDate").value,
    fromCompany: document.getElementById("fromCompany").value,
    fromAddress: document.getElementById("fromAddress").value,
    fromSuburb: document.getElementById("fromSuburb").value,
    fromTown: document.getElementById("fromTown").value,
    fromPostal: document.getElementById("fromPostal").value,
    fromEmail: document.getElementById("fromEmail").value,
    fromContact: document.getElementById("fromContact").value,
    toCompany: document.getElementById("toCompany").value,
    toAddress: document.getElementById("toAddress").value,
    toSuburb: document.getElementById("toSuburb").value,
    toTown: document.getElementById("toTown").value,
    toPostal: document.getElementById("toPostal").value,
    toEmail: document.getElementById("toEmail").value,
    toContact: document.getElementById("toContact").value,
    service: document.getElementById("serviceType").value,
    items,
    pieces: totalPieces,
    descriptions,
    actualWeight: document.getElementById("actualWeight").innerText,
    volWeight: document.getElementById("volWeight").innerText,
    chargeWeight: document.getElementById("chargeWeight").innerText,
    distance: document.getElementById("distance").innerText,
    zoneLabel: document.getElementById("zoneLabel").innerText,
    price: document.getElementById("price").innerText,
    length: document.getElementById("length").value,
    width: document.getElementById("width").value,
    height: document.getElementById("height").value
  };
}

// ----------------------------------------------------------
// 10. SHIPMENT SUMMARY MODAL
// ----------------------------------------------------------
function saveBooking() {
  const data = collectBookingData();

  // Validation
  if (!data.fromCompany || !data.fromAddress || !data.toCompany || !data.toAddress) {
    M.toast({ html: "⚠️ Please fill in all required fields.", classes: "orange darken-2" });
    return;
  }
  if (!data.shipmentDate) {
    M.toast({ html: "⚠️ Please select a shipment date.", classes: "orange darken-2" });
    return;
  }

  const serviceNames = {
    SAMEDAY: "SameDay Express Air",
    ONX: "Overnight Express (ONX)",
    NDX: "NextDay Express",
    ECO: "Economy Service (ECO)"
  };

  const itemRows = data.items.map(i =>
    `<tr><td>${i.qty}</td><td>${i.desc || "—"}</td><td>${i.weight} kg</td></tr>`
  ).join("");

  document.getElementById("summaryBody").innerHTML = `
    <table class="summary-table">
      <tr><th colspan="2" class="summary-section">Shipment</th></tr>
      <tr><td>Date</td><td>${data.shipmentDate}</td></tr>
      <tr><td>Service</td><td>${serviceNames[data.service] || data.service}</td></tr>
      <tr><td>Zone</td><td>${data.zoneLabel}</td></tr>
      <tr><th colspan="2" class="summary-section">Consignor</th></tr>
      <tr><td>Company</td><td>${data.fromCompany}</td></tr>
      <tr><td>Address</td><td>${data.fromAddress}</td></tr>
      <tr><td>Contact</td><td>${data.fromContact}</td></tr>
      <tr><td>Email</td><td>${data.fromEmail}</td></tr>
      <tr><th colspan="2" class="summary-section">Consignee</th></tr>
      <tr><td>Company</td><td>${data.toCompany}</td></tr>
      <tr><td>Address</td><td>${data.toAddress}</td></tr>
      <tr><td>Contact</td><td>${data.toContact}</td></tr>
      <tr><td>Email</td><td>${data.toEmail}</td></tr>
      <tr><th colspan="2" class="summary-section">Items</th></tr>
    </table>
    <table class="summary-table items-table">
      <thead><tr><th>Qty</th><th>Description</th><th>Weight</th></tr></thead>
      <tbody>${itemRows}</tbody>
    </table>
    <table class="summary-table">
      <tr><th colspan="2" class="summary-section">Weight & Dimensions</th></tr>
      <tr><td>Actual Weight</td><td>${data.actualWeight} kg</td></tr>
      <tr><td>Volumetric Weight</td><td>${data.volWeight} kg</td></tr>
      <tr><td>Chargeable Weight</td><td>${data.chargeWeight} kg</td></tr>
      <tr><td>Dimensions (L×W×H)</td><td>${data.length || 0}×${data.width || 0}×${data.height || 0} cm</td></tr>
      <tr><td>Distance</td><td>${data.distance} km</td></tr>
      <tr class="total-row"><td><strong>TOTAL COST</strong></td><td><strong>R ${data.price}</strong></td></tr>
    </table>
  `;

  // Store data for confirm handler
  window._pendingBooking = data;

  const modal = document.getElementById("summaryModal");
  const instance = M.Modal.getInstance(modal);
  instance.open();
}

async function confirmBooking() {
  const data = window._pendingBooking;
  if (!data) return;

  try {
    const waybillNo = generateWaybillNumber();
    data.waybillNo = waybillNo;

    const session = JSON.parse(localStorage.getItem("mokSession") || "{}");

    console.log("SESSION DATA:", session);

    const payload = {
  user_id: session?.user?.id || session?.id || null,
  service: data.service,
  consignor_name: data.fromCompany,
  consignor_address: [
    data.fromAddress,
    data.fromSuburb,
    data.fromTown,
    data.fromPostal
  ].filter(Boolean).join(", "),
  consignor_contact: data.fromContact || data.fromEmail,
  consignee_name: data.toCompany,
  consignee_address: [
    data.toAddress,
    data.toSuburb,
    data.toTown,
    data.toPostal
  ].filter(Boolean).join(", "),
  consignee_contact: data.toContact || data.toEmail,
  weight: parseFloat(data.chargeWeight || 0),
  volumetric_weight: parseFloat(data.volWeight || 0),
  price: parseFloat(data.price || 0),
  zone_label: data.zoneLabel || document.getElementById("zoneLabel")?.innerText || ""
};

console.log("BOOKING PAYLOAD:", payload);
    

    const response = await fetch("http://localhost:5000/api/bookings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error("Booking save failed");
    }

    const savedBooking = await response.json();
    const waybillResponse = await fetch("http://localhost:5000/api/waybills", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        booking_id: savedBooking.id,
        waybill_no: waybillNo,
        weight: parseFloat(data.chargeWeight || 0),
        volumetric_weight: parseFloat(data.volWeight || 0)
      })
    });

    if (!waybillResponse.ok) {
      throw new Error("Waybill save failed");
    }

    const savedWaybill = await waybillResponse.json();
    console.log("✅ Waybill saved to database:", savedWaybill);
    console.log("✅ Booking saved to database:", savedBooking);

    // Keep localStorage temporarily while system is still being migrated
    const existing = JSON.parse(localStorage.getItem("mokBookings") || "[]");
    existing.push({
      ...data,
      bookingId: savedBooking.id,
      createdAt: new Date().toISOString()
    });
    localStorage.setItem("mokBookings", JSON.stringify(existing));

    function buildAddr(company, street, suburb, town, postal, email, contact) {
      const lines = [
        `<strong>${company}</strong>`,
        street,
        suburb,
        town,
        postal,
        email,
        contact
      ].filter(Boolean);

      return lines.join("<br>");
    }

    localStorage.setItem("localWaybill", JSON.stringify({
      bookingId: savedBooking.id,
      waybillNo,
      shipFrom: buildAddr(
        data.fromCompany,
        data.fromAddress,
        data.fromSuburb,
        data.fromTown,
        data.fromPostal,
        data.fromEmail,
        data.fromContact
      ),
      shipTo: buildAddr(
        data.toCompany,
        data.toAddress,
        data.toSuburb,
        data.toTown,
        data.toPostal,
        data.toEmail,
        data.toContact
      ),
      pickupDate: data.shipmentDate,
      deliveryType: (() => {
        const m = {
          SAMEDAY: "SameDay Express Air",
          ONX: "Overnight Express (ONX)",
          NDD: "NextDay Express",
          ECO: "Economy Service (ECO)"
        };
        return m[data.service] || data.service;
      })(),
      pieces: data.pieces,
      weight: data.chargeWeight,
      volumetricWeight: data.volWeight,
      description: data.descriptions,
      price: data.price,
      zoneLabel: data.zoneLabel
    }));

    const modal = document.getElementById("summaryModal");
    M.Modal.getInstance(modal).close();

    M.toast({
      html: `✅ Booking confirmed! Waybill: <strong>${waybillNo}</strong>`,
      classes: "green darken-2",
      displayLength: 5000
    });

    document.getElementById("waybillConfirmBtn").style.display = "inline-flex";
    document.getElementById("waybillConfirmBtn").setAttribute("data-waybill", waybillNo);

    window._pendingBooking = null;

  } catch (err) {
    console.error("❌ Error saving booking:", err);

    M.toast({
      html: "❌ Failed to save booking to database.",
      classes: "red darken-2",
      displayLength: 5000
    });
  }
}

// ----------------------------------------------------------
// 11. WAYBILL & INVOICE NAV
// ----------------------------------------------------------
function generateWaybill() {
  window.location.href = "localWaybill.html";
}

function createInvoice() {
  window.location.href = "invoice.html";
}

// ----------------------------------------------------------
// 12. INIT
// ----------------------------------------------------------
document.addEventListener("DOMContentLoaded", () => {
  // Init Materialize components
  M.Modal.init(document.querySelectorAll(".modal"));
  M.FormSelect.init(document.querySelectorAll("select"));

  // Trigger calculate when service changes
  const sel = document.getElementById("serviceType");
  if (sel) sel.addEventListener("change", calculateAll);

  // Load Google Maps script dynamically
  if (GOOGLE_API_KEY !== "YOUR_GOOGLE_API_KEY_HERE") {
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_API_KEY}&libraries=places&callback=initAutocomplete`;
    script.async = true;
    script.defer = true;
    document.head.appendChild(script);
  } else {
    console.warn("Mok Transports: Replace YOUR_GOOGLE_API_KEY_HERE with a real Google Maps API key to enable address autocomplete and distance calculation.");
    // Fallback: manual distance random
    document.getElementById("fromAddress").addEventListener("blur", fallbackDistance);
    document.getElementById("toAddress").addEventListener("blur", fallbackDistance);
  }
});

function fallbackDistance() {
  const from = document.getElementById("fromAddress").value;
  const to = document.getElementById("toAddress").value;
  if (!from || !to) return;
  const dist = Math.floor(Math.random() * 400) + 20;
  document.getElementById("distance").innerText = dist;
  calculateAll();
}




