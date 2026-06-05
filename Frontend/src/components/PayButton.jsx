import axios from "axios";

export default function PayButton({ email, amount, studentId }) {
  const handlePayment = async () => {
    const res = await axios.post("/api/payment/initialize", {
      email,
      amount,
      studentId,
    });

    window.location.href = res.data.authorization_url;
  };

  return <button onClick={handlePayment}>Pay ₦{amount}</button>;
}
