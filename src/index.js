import express, { json } from "express";
import cors from "cors";
import { MongoClient, ObjectId } from "mongodb";
import dotenv from "dotenv";
dotenv.config();
import Joi from "joi";


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

app.post("/sign-up", async (req, res) => {
    if (!req.body || Object.keys(req.body).length === 0) {
        return res.status(400).send("Corpo da requisição não pode estar vazio");
    }

    const { username, avatar } = req.body;

    // Validação com Joi
    const schema = Joi.object({
        username: Joi.string().required(),
        avatar: Joi.string().uri().required()
    });

    const { error } = schema.validate(req.body);

    if (error) {
        return res.status(400).send(error.details[0].message);
    }

    try {
        const existingUser = await db.collection("users").findOne({ username });
        if (existingUser) {
            return res.status(409).send("Usuário já existe!");
        }

        await db.collection("users").insertOne({ username, avatar });
        res.status(201).send("Usuário criado com sucesso!");
    } catch (err) {
        console.error("Erro ao criar usuário:", err.message);
        res.status(500).send("Erro ao processar requisição");
    }
});


app.post("/tweets", async (req, res) => {
    const { username, tweet } = req.body;

    // Validação com Joi
    const schema = Joi.object({
        username: Joi.string().required(),
        tweet: Joi.string().required()
    });

    const { error } = schema.validate(req.body);

    if (error) {
        return res.status(400).send(error.details[0].message);
    }

    try {
        const user = await db.collection("users").findOne({ username });
        if (!user) {
            return res.status(401).send("UNAUTHORIZED");
        }

        const newTweet = {
            username,
            tweet,
            createdAt: new Date() // adicionando a data para ordenar depois
        };

        await db.collection("tweets").insertOne(newTweet);
        res.status(201).send("Seu tweet foi enviado com sucesso!");
    } catch (err) {
        console.log(err.message);
        res.status(500).send("Erro ao processar requisição");
    }
});


app.get("/tweets/:id", (req, res) => {
    const id = req.params.id;

    //busca feita pelo mongodb 
    db.collection("tweets").findOne({
        _id: ObjectId(id)
    })
        .then(tweet => {
            res.send(tweet);
        })
        .catch(err => {
            console.log(err.message);
            res.status(404).send("Erro ao buscar tweet");
        });
 

});



app.put("/tweets/:id", async (req, res) => {
    const { id } = req.params;
    const { tweet } = req.body;

    // Validação com Joi
    const schema = Joi.object({
        tweet: Joi.string().required()
    });

    const { error } = schema.validate(req.body);
    if (error) {
        return res.status(400).send(error.details[0].message);
    }

    try {
        const tweetObjectId = new ObjectId(id);

        const result = await db.collection("tweets").findOneAndUpdate(
            { _id: tweetObjectId },
            { $set: { tweet, updatedAt: new Date() } }, // opcional: salva também a data de atualização
            { returnDocument: "after" } // retorna o documento atualizado
        );

        if (!result.value) {
            return res.status(404).send("Tweet não encontrado");
        }

        res.send({
            message: "Tweet atualizado com sucesso!",
            tweet: result.value
        });
    } catch (err) {
        console.log(err.message);
        res.status(500).send("Erro ao atualizar tweet");
    }
});

app.delete("/tweets/:id", async (req, res) => {
    const { id } = req.params;

    try {
        const tweetObjectId = new ObjectId(id);

        const result = await db.collection("tweets").deleteOne({ _id: tweetObjectId });

        if (result.deletedCount === 0) {
            return res.status(404).send("Tweet não encontrado");
        }

        res.send("Tweet deletado com sucesso!");
    } catch (err) {
        console.log(err.message);
        res.status(500).send("Erro ao deletar tweet");
    }
});



const porta = process.env.PORTA || 5000;
app.listen(porta, () => {
    console.log(`Servidor rodando na porta ${porta}`);
});