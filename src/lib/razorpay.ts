import Razorpay from 'razorpay'

// Ensure we don't crash on client-side imports or if secrets are missing initially
const key_id = process.env.RAZORPAY_KEY_ID || 'dummy_key'
const key_secret = process.env.RAZORPAY_KEY_SECRET || 'dummy_secret'

export const razorpay = new Razorpay({
  key_id,
  key_secret,
})

export default razorpay
