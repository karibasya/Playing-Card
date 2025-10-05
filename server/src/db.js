import mongoose from 'mongoose';

export async function connectMongo(uri) {
  if (!uri) throw new Error('MONGODB_URI is required');
  mongoose.set('strictQuery', true);
  await mongoose.connect(uri, {
    serverSelectionTimeoutMS: 10000,
  });
  return mongoose.connection;
}

const historySchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    meta: { type: String, required: true },
    amount: { type: String, default: '' },
  },
  { _id: false }
);

const cardSchema = new mongoose.Schema(
  {
    _id: { type: String }, // card id
    balance: { type: Number, default: 0 },
    status: { type: String, default: 'active' },
    player: {
      name: { type: String, default: '' },
      phone: { type: String, default: '' },
      notes: { type: String, default: '' },
    },
    history: { type: [historySchema], default: [] },
  },
  { timestamps: true, versionKey: false }
);

cardSchema.methods.toPublic = function () {
  return {
    id: this._id,
    balance: this.balance,
    status: this.status,
    player: this.player,
  };
};

export const Card = mongoose.models.Card || mongoose.model('Card', cardSchema);


