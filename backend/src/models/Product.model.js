const mongoose = require('mongoose');

const productSchema = new mongoose.Schema(
{
    name: {
        type: String,
        required: true,
        trim: true,
    },
    description: {
        type: String,
        required: true,
    },
    price: {
        type: Number,
        required: true,
    },
    discoutPrice: {
        type: Number,
    },
    stock: {
        type: Number,
        required: true,
        default: 0,
    },
    category: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Category',
    },
    images: [
        {
            type: String,
        },
    ],

    isActive: {
        type: Boolean,
        default: true,
    },
    
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Product', productSchema);