import express, { json } from "express";
import cors from "cors";
import { MongoClient } from "mongodb";
import dotenv from "dotenv";
dotenv.config();


const app = express();
app.use(cors());
app.use(json());

//conexão do banco de dados.
const mongoURL = process.env.DATABASE_URL;
 const mongoClient = new MongoClient(mongoURL);
let db;

mongoClient.connect()
    .then(() => {
        console.log("MongoDB conectado com sucesso!");
        db = mongoClient.db()
    })
    .catch(err => console.log(err.message));


    app.get("/tweets", async (req, res) => {
        try {
            const tweets = await db.collection("tweets")
                .find()
                .sort({ createdAt: -1 }) // ⬅️ Ordenando por data (mais recentes primeiro)
                .toArray();
    
            const tweetsComAvatar = await Promise.all(
                tweets.map(async (tweet) => {
                    const user = await db.collection("users").findOne({ username: tweet.username });
                    return {
                        _id: tweet._id,
                        username: tweet.username,
                        avatar: user ? user.avatar : null,
                        tweet: tweet.tweet
                    };
                })
            );
    
            res.send(tweetsComAvatar);
        } catch (err) {
            console.log(err.message);
            res.status(500).send("Erro ao buscar tweets");
        }
    });
    
app.post("/sign-up", (req, res) => {
    const { username, avatar } = req.body;
    if (!username || !avatar) {
        return res.status(400).send("Todos os campos são obrigatórios!");
    }

    // Verifica se o usuário já existe no banco de dados
    db.collection("users").findOne({ username })
        .then(existingUser => {
            if (existingUser) {
                return res.status(409).send("Usuário já existe!");
            }

            // Insere o novo usuário no banco de dados
            db.collection("users").insertOne({ username, avatar })
                .then(() => {
                    res.status(201).send("Usuário criado com sucesso!");
                })
                .catch(err => {
                    console.log(err.message);
                    res.status(500).send("Erro ao inserir usuário");
                });
        })
        .catch(err => {
            console.log(err.message);
            res.status(500).send("Erro ao verificar usuário");
        });
});

app.post("/tweets", (req, res) => {
    const { username, tweet } = req.body;
    if (!username || !tweet) {
        return res.status(400).send("Todos os campos são obrigatórios!");
    }

    db.collection("users").findOne({ username })
        .then(user => {
            if (!user) {
                return res.status(401).send("UNAUTHORIZED");
            }

            const newTweet = { 
                username, 
                tweet,
                createdAt: new Date() // ⬅️ Adicionamos a data aqui
            };

            db.collection("tweets").insertOne(newTweet)
                .then(() => {
                    res.status(201).send("Seu tweet foi enviado com sucesso!");
                })
                .catch(err => {
                    console.log(err.message);
                    res.status(500).send("Erro ao inserir tweet");
                });
        })
        .catch(err => {
            console.log(err.message);
            res.status(500).send("Erro ao verificar usuário");
        });
});


const porta = process.env.PORTA || 5000;
app.listen(porta, () => {
    console.log(`Servidor rodando na porta ${porta}`);
});