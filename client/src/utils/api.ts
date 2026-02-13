import axios from "axios";

const API_URL = import.meta.env.VITE_API_URL ; // replace with your backend URL

export const signupUser = async (signupData: any) => {
  const response = await axios.post(`${API_URL}/api/auth/register`, signupData);
  return response.data;
};

export const loginUser = async (loginData: any) => {
  const response = await axios.post(`${API_URL}/api/auth/login`, loginData);
  return response.data;
};

export const googleLoginUser = async (credential: string) => {
  const response = await axios.post(
    `${API_URL}/api/auth/google-login`,
    { credential }
  );
  return response.data;
};
