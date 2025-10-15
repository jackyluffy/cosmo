"use strict";
// Event venues and templates configuration for Placentia, CA area
Object.defineProperty(exports, "__esModule", { value: true });
exports.EVENT_TEMPLATES = exports.VENUES = void 0;
exports.getRandomEventTemplate = getRandomEventTemplate;
exports.getEventTemplatesByType = getEventTemplatesByType;
// Venues in Placentia, CA and surrounding areas (within 20 miles)
exports.VENUES = {
    // Tennis
    TRI_CITY_TENNIS: {
        name: 'Tri-City Park Tennis Courts',
        address: '2301 N Kraemer Blvd, Placentia, CA 92870',
        lat: 33.8789,
        lng: -117.8547,
        photos: ['https://images.unsplash.com/photo-1554068865-24cecd4e34b8?w=800'],
    },
    // Bars
    THE_PACKING_HOUSE: {
        name: 'The Packing House',
        address: '440 S Anaheim Blvd, Anaheim, CA 92805',
        lat: 33.8309,
        lng: -117.9101,
        photos: ['https://images.unsplash.com/photo-1566417713940-fe7c737a9ef2?w=800'],
    },
    NOBLE_ALE_WORKS: {
        name: 'Noble Ale Works',
        address: '1621 S Sinclair St #B, Anaheim, CA 92806',
        lat: 33.8089,
        lng: -117.9234,
        photos: ['https://images.unsplash.com/photo-1572116469696-31de0f17cc34?w=800'],
    },
    // Brunch
    SIDECAR_DOUGHNUTS: {
        name: 'Sidecar Doughnuts & Coffee',
        address: '270 E 17th St, Costa Mesa, CA 92627',
        lat: 33.6267,
        lng: -117.9176,
        photos: ['https://images.unsplash.com/photo-1550258987-190a2d41a8ba?w=800'],
    },
    MADISON_SQUARE: {
        name: 'Madison Square & Garden Bar',
        address: '17571 17th St, Tustin, CA 92780',
        lat: 33.7425,
        lng: -117.8261,
        photos: ['https://images.unsplash.com/photo-1504754524776-8f4f37790ca0?w=800'],
    },
    // Dinner
    HAVEN_GASTROPUB: {
        name: 'Haven Gastropub',
        address: '190 S Glassell St, Orange, CA 92866',
        lat: 33.7863,
        lng: -117.8531,
        photos: ['https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800'],
    },
    WILD_ARTICHOKE: {
        name: 'Wild Artichoke',
        address: '250 E Chapman Ave, Placentia, CA 92870',
        lat: 33.8709,
        lng: -117.8492,
        photos: ['https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=800'],
    },
    // Hiking
    CARBON_CANYON_PARK: {
        name: 'Carbon Canyon Regional Park',
        address: '4442 Carbon Canyon Rd, Brea, CA 92823',
        lat: 33.9123,
        lng: -117.8456,
        photos: ['https://images.unsplash.com/photo-1551632811-561732d1e306?w=800'],
    },
    PETERS_CANYON: {
        name: 'Peters Canyon Regional Park',
        address: '8548 E Canyon View Ave, Orange, CA 92869',
        lat: 33.7734,
        lng: -117.7512,
        photos: ['https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=800'],
    },
};
exports.EVENT_TEMPLATES = [
    // Tennis Events
    {
        type: 'tennis',
        category: 'sports',
        title: 'Sunset Tennis Mixer',
        description: 'Join us for a fun evening of doubles tennis followed by drinks. All skill levels welcome!',
        venue: exports.VENUES.TRI_CITY_TENNIS,
        priceRange: { min: 15, max: 25 },
        durationMinutes: 120,
        ageRange: { min: 21, max: 45 },
        groupSize: 4,
    },
    {
        type: 'tennis',
        category: 'sports',
        title: 'Weekend Tennis Social',
        description: 'Saturday morning tennis followed by brunch. Perfect for meeting active singles!',
        venue: exports.VENUES.TRI_CITY_TENNIS,
        priceRange: { min: 20, max: 30 },
        durationMinutes: 180,
        ageRange: { min: 25, max: 50 },
        groupSize: 6,
    },
    // Bar Events
    {
        type: 'bar',
        category: 'food',
        title: 'Craft Beer Tasting Night',
        description: 'Sample local craft beers and meet fellow beer enthusiasts in a relaxed atmosphere.',
        venue: exports.VENUES.NOBLE_ALE_WORKS,
        priceRange: { min: 25, max: 40 },
        durationMinutes: 150,
        ageRange: { min: 21, max: 40 },
        groupSize: 4,
    },
    {
        type: 'bar',
        category: 'food',
        title: 'Friday Night Social at The Packing House',
        description: 'Explore artisan food vendors and craft cocktails while mingling with new friends.',
        venue: exports.VENUES.THE_PACKING_HOUSE,
        priceRange: { min: 30, max: 50 },
        durationMinutes: 180,
        ageRange: { min: 23, max: 45 },
        groupSize: 6,
    },
    // Brunch Events
    {
        type: 'brunch',
        category: 'food',
        title: 'Sunday Brunch & Coffee',
        description: 'Start your Sunday with delicious doughnuts, coffee, and great conversation.',
        venue: exports.VENUES.SIDECAR_DOUGHNUTS,
        priceRange: { min: 15, max: 25 },
        durationMinutes: 120,
        ageRange: { min: 21, max: 55 },
        groupSize: 4,
    },
    {
        type: 'brunch',
        category: 'food',
        title: 'Bottomless Brunch Social',
        description: 'Enjoy bottomless mimosas and amazing food while making new connections.',
        venue: exports.VENUES.MADISON_SQUARE,
        priceRange: { min: 35, max: 50 },
        durationMinutes: 150,
        ageRange: { min: 25, max: 45 },
        groupSize: 6,
    },
    // Dinner Events
    {
        type: 'dinner',
        category: 'food',
        title: 'Wine & Dine Experience',
        description: 'Elegant dinner featuring wine pairings and intimate group seating.',
        venue: exports.VENUES.HAVEN_GASTROPUB,
        priceRange: { min: 50, max: 80 },
        durationMinutes: 180,
        ageRange: { min: 28, max: 55 },
        groupSize: 4,
    },
    {
        type: 'dinner',
        category: 'food',
        title: 'Farm-to-Table Dinner Party',
        description: 'Fresh seasonal ingredients in a cozy setting. Perfect for foodies!',
        venue: exports.VENUES.WILD_ARTICHOKE,
        priceRange: { min: 40, max: 65 },
        durationMinutes: 150,
        ageRange: { min: 25, max: 50 },
        groupSize: 6,
    },
    // Hiking Events
    {
        type: 'hiking',
        category: 'sports',
        title: 'Morning Hike & Coffee',
        description: 'Easy 3-mile trail hike followed by coffee. Great for outdoor enthusiasts!',
        venue: exports.VENUES.CARBON_CANYON_PARK,
        priceRange: { min: 0, max: 10 },
        durationMinutes: 120,
        ageRange: { min: 21, max: 60 },
        groupSize: 4,
    },
    {
        type: 'hiking',
        category: 'sports',
        title: 'Sunset Trail Adventure',
        description: 'Moderate 4-mile hike with stunning canyon views. All levels welcome!',
        venue: exports.VENUES.PETERS_CANYON,
        priceRange: { min: 0, max: 5 },
        durationMinutes: 150,
        ageRange: { min: 23, max: 55 },
        groupSize: 6,
    },
];
function getRandomEventTemplate() {
    return exports.EVENT_TEMPLATES[Math.floor(Math.random() * exports.EVENT_TEMPLATES.length)];
}
function getEventTemplatesByType(type) {
    return exports.EVENT_TEMPLATES.filter(template => template.type === type);
}
//# sourceMappingURL=events.config.js.map