import { pipe } from "fp-ts/function";
import * as TE from "fp-ts/TaskEither";
import express, {
  NextFunction,
  Request as ExpressRequest,
  Response,
} from "express";
import { env } from "@/helpers";
import { JWTPayload, verifyJWT } from "@/ports/adapters/jwt";
import cors from "cors";
import * as user from "@/ports/adapters/http/modules/user";
import * as article from "@/ports/adapters/http/modules/article";
import { getErrorsMessages } from "@/ports/adapters/http/http";

type Request = ExpressRequest & { auth?: JWTPayload };

const PORT = env("PORT");

const app = express();
app.use(cors());

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.disable("x-powered-by").disable("etag");

// Public
app.post("/api/users", (req, res) => {
  return pipe(
    req.body.user,
    user.createUser,
    TE.map((result) => res.json(result)),
    TE.mapLeft((error) => res.status(422).json(error))
  )();
});

app.post("/api/users/login", (req: Request, res: Response) => {
  return pipe(
    req.body.user,
    user.login,
    TE.map((result) => res.json(result)),
    TE.mapLeft((error) => res.status(422).json(error))
  )();
});

const auth = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = req.header("authorization")?.replace("Token ", "")!;
    const payload = await verifyJWT(token);
    req.auth = payload;
    next();
  } catch {
    // If the user is not authorized
    res.status(401).json(getErrorsMessages("You need to be authorized"));
  }
};

// Private
app.post("/api/articles", auth, async (req: Request, res: Response) => {
  const payload = req.auth ?? {};

  const data = {
    ...req.body.article,
    authorID: payload["id"],
  };

  return pipe(
    data,
    article.createArticle,
    TE.map((result) => res.json(result)),
    TE.mapLeft((error) => res.status(422).json(error))
  )();
});

app.post("/api/articles/:slug/comments", auth, (req: Request, res: Response) => {
  const payload = req.auth ?? {};

  const data = {
    ...req.body.comment,
    authorID: payload["id"],
    articleSlug: req.params["slug"],
  };

  return pipe(
    data,
    article.addCommentToAnArticle,
    TE.map((result) => res.json(result)),
    TE.mapLeft((error) => res.status(422).json(error))
  )();
});

export const start = async () => {
  app.listen(PORT, () => {
    console.log(`Server listing on port ${PORT}`);
  });
};