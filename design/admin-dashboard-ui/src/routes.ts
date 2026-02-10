import { createBrowserRouter } from "react-router";
import { Layout } from "./components/Layout";
import { Dashboard } from "./components/Dashboard";
import { Properties } from "./components/Properties";
import { Clients } from "./components/Clients";
import { Documents } from "./components/Documents";
import { Users } from "./components/Users";

export const router = createBrowserRouter([
  {
    path: "/",
    Component: Layout,
    children: [
      { index: true, Component: Dashboard },
      { path: "properties", Component: Properties },
      { path: "clients", Component: Clients },
      { path: "documents", Component: Documents },
      { path: "users", Component: Users },
    ],
  },
]);
