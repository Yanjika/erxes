import {
  Config,
  IUser,
  NotificationsCountQueryResponse,
  NotificationsQueryResponse,
  UserQueryResponse,
} from "./types";
import React, { createContext, useEffect } from "react";
import { gql, useQuery } from "@apollo/client";

import Spinner from "./common/Spinner";
import { clientPortalGetConfig } from "./main/graphql/queries";
import { getKbTopicQuery } from "./knowledgeBase/graphql/queries";
import queries from "./user/graphql/queries";
import { sendDesktopNotification } from "./utils";
import subscriptions from "./user/graphql/subscriptions";

const AppContext = createContext({});

export const AppConsumer = AppContext.Consumer;

type Props = {
  children: any;
};

function AppProvider({ children }: Props) {
  const [currentUser, setCurrentUser] = React.useState({} as IUser);
  const [notificationsCount, setNotificationsCount] = React.useState(0);

  const userQuery = useQuery<UserQueryResponse>(gql(queries.currentUser));

  const notificationsCountQry = useQuery<NotificationsCountQueryResponse>(
    gql(queries.notificationsCountQuery),
    {
      skip: !currentUser,
    }
  );

  useEffect(() => {
    if (userQuery.data && userQuery.data.clientPortalCurrentUser) {
      setCurrentUser(userQuery.data.clientPortalCurrentUser);
    }

    if (
      notificationsCountQry.data &&
      notificationsCountQry.data.clientPortalNotificationCount
    ) {
      setNotificationsCount(
        notificationsCountQry.data.clientPortalNotificationCount
      );
    }

    const unsubscribe = notificationsCountQry.subscribeToMore({
      document: gql(subscriptions.notificationSubscription),
      variables: { userId: currentUser && currentUser._id },
      updateQuery: (prev, { subscriptionData }) => {
        if (!subscriptionData.data) {
          return prev;
        }

        const {
          clientPortalNotificationInserted,
        } = subscriptionData.data as any;

        const { title, content } = clientPortalNotificationInserted;

        sendDesktopNotification({ title, content });

        notificationsCountQry.refetch();
      },
    });

    const unsubscribe2 = notificationsCountQry.subscribeToMore({
      document: gql(subscriptions.notificationRead),
      variables: { userId: currentUser && currentUser._id },
      updateQuery: (prev, { subscriptionData }) => {
        if (!subscriptionData.data) {
          return prev;
        }

        notificationsCountQry.refetch();
      },
    });

    return () => {
      unsubscribe();
      unsubscribe2();
    };
  }, [
    userQuery,
    currentUser,
    notificationsCountQry,
    notificationsCount,
    setNotificationsCount,
  ]);

  const response: any = useQuery(gql(clientPortalGetConfig), {});

  const config: Config = response.data
    ? response.data.clientPortalGetConfigByDomain
    : {};

  const topicResponse = useQuery(gql(getKbTopicQuery), {
    variables: {
      _id: config.knowledgeBaseTopicId,
    },
    skip: !config.knowledgeBaseTopicId,
  });

  const topic =
    (topicResponse.data
      ? topicResponse.data.clientPortalKnowledgeBaseTopicDetail
      : {}) || {};

  if (userQuery.loading || response.loading) {
    return <Spinner />;
  }

  return (
    <AppContext.Provider
      value={{
        config,
        currentUser,
        topic,
        notificationsCount,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export default AppProvider;
