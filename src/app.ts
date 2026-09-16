import express, { Request, Response } from "express"
import cors from "cors"
import cookieParser from "cookie-parser";
import { router } from "./app/routes";
import { globalErrorHandler } from "./app/middlewares/globalErrorHandler";
import notFound from "./app/middlewares/notFound";
import { envVars } from "./app/config/env";
import dns from "dns"
dns.setServers(["1.1.1.1", "8.8.8.8"])



const app = express()
app.use(cookieParser());
app.set("trust proxy", 1)
app.use(express.urlencoded({ extended: true }))
app.use(cors({
    origin: [
        envVars.FRONTEND_URL,
        "http://localhost:3000",
        "https://shurokkha-frontend.vercel.app",
        "https://shurokkhaa.vercel.app",
        "https://surokkha-frontend.vercel.app"
    ],
    credentials: true
}))

app.use(express.json())

app.use("/api/v1", router)

app.get("/", (req: Request, res: Response) => {
    res.status(200).json({
        message: "Insurance Management application is running!!!"
    })
})

app.use(globalErrorHandler)

app.use(notFound)

export default app;