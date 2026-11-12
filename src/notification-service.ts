import { randomUUID } from "node:crypto";
import type Redis from "ioredis";

export const NOTIFICATION_CHANNEL = "notifications:events";

export type Notification = {
  id: string;
  type: string;
  title: string;
  message: string;
  createdAt: string;
  data: Record<string, unknown>;
};

export type NotificationInput = Omit<
  Notification,
  "id" | "createdAt"
>;

type NotificationListener = (notification: Notification) => void;

export class NotificationService {
  private readonly subscriber: Redis;
  private readonly listeners = new Set<NotificationListener>();
  private started = false;

  constructor(private readonly publisher: Redis) {
    this.subscriber = publisher.duplicate();

    this.subscriber.on("message", (channel, rawMessage) => {
      if (channel !== NOTIFICATION_CHANNEL) {
        return;
      }

      try {
        const notification = JSON.parse(rawMessage) as Notification;

        for (const listener of this.listeners) {
          listener(notification);
        }
      } catch (error) {
        console.error("Could not read notification message:", error);
      }
    });

    this.subscriber.on("error", (error) => {
      console.error("Notification subscriber error:", error);
    });
  }

  async start(): Promise<void> {
    if (this.started) {
      return;
    }

    await this.subscriber.subscribe(NOTIFICATION_CHANNEL);
    this.started = true;
  }

  async publish(input: NotificationInput): Promise<Notification> {
    const notification: Notification = {
      ...input,
      id: randomUUID(),
      createdAt: new Date().toISOString(),
    };

    await this.publisher.publish(
      NOTIFICATION_CHANNEL,
      JSON.stringify(notification)
    );

    return notification;
  }

  onNotification(listener: NotificationListener): () => void {
    this.listeners.add(listener);

    return () => {
      this.listeners.delete(listener);
    };
  }

  async stop(): Promise<void> {
    if (this.started) {
      await this.subscriber.unsubscribe(NOTIFICATION_CHANNEL);
    }

    await this.subscriber.quit();
    this.started = false;
  }
}