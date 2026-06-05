import axios from "axios";

const BASE_URL = "https://api.paystack.co";

export const initializePayment = async ({ email, amount, reference }) => {
  const res = await axios.post(
    `${BASE_URL}/transaction/initialize`,
    {
      email,
      amount: amount * 100,
      reference,
    },
    {
      headers: {
        Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
      },
    },
  );

  return res.data.data;
};

export const verifyPayment = async (reference) => {
  const res = await axios.get(`${BASE_URL}/transaction/verify/${reference}`, {
    headers: {
      Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
    },
  });

  return res.data.data;
};
