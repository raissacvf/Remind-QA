import { createApp } from "./app";
import { config } from "./config";

createApp().listen(config.PORT, () => {
  console.log(`API rodando em http://localhost:${config.PORT}`);
});
