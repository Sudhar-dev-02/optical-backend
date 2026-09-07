const mongoose = require('mongoose');

const catalogSchema = new mongoose.Schema({
  key: { type: String, default: 'main_catalog', unique: true },
  orderTakenOptions: { type: [String], default: ['Babu', 'Abrar', 'Janani', 'Arafath'] },
  prescribedByOptions: { type: [String], default: ['Bushra', 'Janani', 'Aravint Hsptl', 'Vivekanandha', 'Agarwal'] },
  lensTypes: { type: [String], default: ['SV', 'Bifocal', 'Progressive'] },
  lensCoatings: { type: [String], default: ['HC', 'HMC', 'Bluecut', 'Bluecut, Blue', 'Bluecut Green', 'PG HC', 'PG HMC', 'PG Bluecut HMC', 'PG Bluecut green', 'PG Bluecut Blue'] },
  lensBrands: { type: [String], default: ['essilor', 'crizal', 'zeiss', 'hoya', 'regular'] },
  lensWarranties: { type: [String], default: ['NIL', '6 months', '1 year', '2 years'] },
  frameTypes: { type: [String], default: ['Supra', 'Full frame', 'Rimless', 'Sunglass', 'Reading glass', 'Contact lens'] },
  frameBrands: { type: [String], default: ['Arcadio', 'IDEE', 'Iris', 'Fastrack', 'Titan', 'Rayban', 'Infinity', 'Nova', 'Velocity', 'Opium', 'Sizzler', 'Taghills'] },
  frameWarranties: { type: [String], default: ['NIL', '6 months', '1 year', '2 years'] }
}, { timestamps: true });

module.exports = mongoose.model('Catalog', catalogSchema);
