import express from "express";


const app = express();//instance of express

app.use(express.json());//middleware to parse incoming JSON requests

export default app;
