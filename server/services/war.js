import { War, Battle } from "../models/War.js";
import Territory from "../models/Territory.js";

const getWars = async () => {
    return await War.find().exec();
};

const getWar = async (id = '') => {
    const doc = await War.findById(id).
        populate('belligerents.aggressors').
        populate('belligerents.defenders').
        exec();
    return doc;
};

const queryWar = async ({ name = '', aggressors = '', defenders = '', territory = '' }) => {
    const regex = RegExp(name);
    const doc = await War.find({
        name: regex,
        aggressors,
        defenders,
        territory
    }).exec();

    return doc;
};

const newWar = async ({ name = '', belligerents = {aggressors: [], defenders: []} }) => {
    const doc = new War({
        name,
        ongoing: true
    });
    doc.belligerents = belligerents;
    const savedDoc = doc.save();

    return savedDoc;
};

const updateWar = async (id, field, value) => {
    // Fields setting
    let fields = [field];
    if (field.includes('-')) { fields = field.split('-') };

    const doc = await War.findById(id).exec();
    if (doc[fields[0]] === undefined || field === 'battles') { throw new Error('Field not found') };

    // Additional effects
    if (field === 'ongoing') {
        if (value === true) { throw new Error('Cannot restart a War. Try making a new War instead') };

        // Stops every ongoing battles
        await doc.populate('battles');
        doc.battles.forEach(async battle => {
            if (battle.ongoing !== value) { battle.ongoing = value; await battle.save(); };
        });
    };

    // Setters
    switch (fields[0]) {
        case 'belligerents':
            doc[fields[0]][fields[1]].push(value);
            break;
    
        default:
            doc[field] = value;
            break;
    };

    await doc.save();
    return doc;
};


const getBattles = async (id, query = {}) => {
    const doc = await War.findById(id).
        populate({
            path: 'battles',
            match: query
        }).
        exec();

    return doc.battles;
};

const getBattle = async (id, index) => {
    const warDoc = await War.findById(id).lean().exec();
    const doc = await Battle.findById(warDoc.battles[index]).
        populate('belligerents.aggressors').
        populate('belligerents.defenders').
        exec();

    return doc;
}

const addBattle = async ({ name = '', territory = '', belligerents = {aggressors: [], defenders: []}, territoryTo }, warId = '') => {
    const territoryDoc = await Territory.findById(territory).exec();
    const warDoc = await War.findById(warId).exec();
    // Error catchers
    if (!territoryDoc) { throw new Error('Territory not found'); };
    if (territoryDoc.currentBattle) { throw new Error(`Territory ${territoryDoc.name} is already in a battle`); };
    if (!warDoc) { throw new Error('War not found'); };

    const battleDoc = new Battle({
        name,
        war: warId,
        territory,
        belligerents,
        ongoing: true,
        victory: {
            victor: [],
            territoryTo
        }
    });
    const savedDoc = await battleDoc.save();

    warDoc.battles.push(savedDoc._id);
    await warDoc.save();

    savedDoc.index = warDoc.battles.length - 1;
    await savedDoc.save();

    territoryDoc.currentBattle = savedDoc._id;
    await territoryDoc.save();

    return savedDoc;
};

const updateBattle = async (id, index, field, value) => {
    // Fields setting
    let fields = [field];
    if (field.includes('-')) { fields = field.split('-') };

    const war = await War.findById(id).lean().exec();
    const doc = await Battle.findById(war.battles[index]).exec();
    if (doc[fields[0]] === undefined) { throw new Error('Field not found'); };

    // Additional effects
    if (field === 'ongoing') {
        if (value === true) { throw new Error('Cannot restart a Battle. Try making a new Battle instead'); };
        const territoryDoc = await Territory.findById(doc.territory);
        territoryDoc.currentBattle = null;
        await territoryDoc.save();
    };

    if (field === 'victory' && value === 'aggressors') {
        const territoryDoc = await Territory.findById(doc.territory).exec();
        territoryDoc.occupant = doc.victory.territoryTo;
        await territoryDoc.save();
    };

    // Setters
    switch (fields[0]) {
        case 'belligerents':
            doc[fields[0]][fields[1]].push(value);
            break;

        case 'victory':
            doc.victory.victor.push(...doc.belligerents[value]);
            break;
    
        default:
            doc[field] = value;
            break;
    };

    await doc.save();
    return doc;
};


export default { getWars, getWar, queryWar, newWar, updateWar, getBattles, getBattle, addBattle, updateBattle };