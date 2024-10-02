const mongoose = require('mongoose');
const Schema = mongoose.Schema;

// Define the schema for credit transactions
const creditTransactionSchema = new Schema({
  areaOfUse: {
    type: String,
    enum: ['video', 'image', 'pdf','transfer'],
    required: true
  },
  senderId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  recieverId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: false
  },
  eventId: {
    type: Schema.Types.ObjectId,
    ref: 'Event',
    required: false
  },
  amount: {
    type: Number,
    required: true
  },
  status:{
    type:String,
    enum:['pending','rejected','completed'],
    required:true
  },
  transactionDate: {
    type: Date,
    default: Date.now
  },
  customerId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: false
  }
});

// Create the model for credit transactions
const CreditTransaction = mongoose.model('CreditTransaction', creditTransactionSchema);

module.exports = CreditTransaction;
