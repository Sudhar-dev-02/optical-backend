const Catalog = require('../models/Catalog');
const mongoose = require('mongoose');

const defaultCatalog = {
  key: 'main_catalog',
  orderTakenOptions: ['Babu', 'Abrar', 'Janani', 'Arafath'],
  prescribedByOptions: ['Bushra', 'Janani', 'Aravint Hsptl', 'Vivekanandha', 'Agarwal'],
  lensTypes: ['SV', 'Bifocal', 'Progressive'],
  lensCoatings: ['HC', 'HMC', 'Bluecut', 'Bluecut, Blue', 'Bluecut Green', 'PG HC', 'PG HMC', 'PG Bluecut HMC', 'PG Bluecut green', 'PG Bluecut Blue'],
  lensBrands: ['essilor', 'crizal', 'zeiss', 'hoya', 'regular'],
  lensWarranties: ['NIL', '6 months', '1 year', '2 years'],
  frameTypes: ['Supra', 'Full frame', 'Rimless', 'Sunglass', 'Reading glass', 'Contact lens'],
  frameBrands: ['Arcadio', 'IDEE', 'Iris', 'Fastrack', 'Titan', 'Rayban', 'Infinity', 'Nova', 'Velocity', 'Opium', 'Sizzler', 'Taghills'],
  frameWarranties: ['NIL', '6 months', '1 year', '2 years']
};

let inMemoryCatalog = { ...defaultCatalog };

const isMongoConnected = () => mongoose.connection.readyState === 1;

exports.getCatalog = async (req, res) => {
  try {
    if (isMongoConnected()) {
      let catalog = await Catalog.findOne({ key: 'main_catalog' });
      if (!catalog) {
        catalog = new Catalog(defaultCatalog);
        await catalog.save();
      }
      return res.json(catalog);
    } else {
      return res.json(inMemoryCatalog);
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.updateCatalog = async (req, res) => {
  try {
    const updateData = req.body;
    if (isMongoConnected()) {
      const catalog = await Catalog.findOneAndUpdate(
        { key: 'main_catalog' },
        { $set: updateData },
        { new: true, upsert: true }
      );
      return res.json(catalog);
    } else {
      inMemoryCatalog = { ...inMemoryCatalog, ...updateData };
      return res.json(inMemoryCatalog);
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
