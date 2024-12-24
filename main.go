package main

import (
	"database/sql"
	"github.com/gofiber/fiber/v2/middleware/cors"
	"log"
	"math/rand"
	"sync"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/websocket/v2"
	_ "github.com/mattn/go-sqlite3"
)

// Message represents a chat message
type Message struct {
	ID         string    `json:"id"`
	FromID     string    `json:"fromId"`
	ToID       string    `json:"toId"`
	Content    string    `json:"content"`
	Timestamp  time.Time `json:"timestamp"`
	Delivered  bool      `json:"delivered"`
	ReadStatus bool      `json:"readStatus"`
	Status     string    `json:"status"`
}

// Client represents a connected websocket client
type Client struct {
	ID       string
	Conn     *websocket.Conn
	IsOnline bool
}

// Global variables
var (
	clients    = make(map[string]*Client)
	clientsMux sync.RWMutex
	db         *sql.DB
)

func main() {
	// Initialize SQLite database
	initDB()

	app := fiber.New()

	// Add CORS middleware with more permissive settings
	app.Use(cors.New(cors.Config{
		AllowOrigins: "*", // Allow all origins for development
		AllowHeaders: "Origin, Content-Type, Accept",
		AllowMethods: "GET, POST, HEAD, PUT, DELETE, PATCH",
	}))

	// Routes
	app.Use("/ws/:id", func(c *fiber.Ctx) error {
		log.Printf("Received WebSocket connection request from user: %s", c.Params("id"))
		if websocket.IsWebSocketUpgrade(c) {
			log.Printf("WebSocket upgrade requested for user: %s", c.Params("id"))
			c.Locals("allowed", true)
			return c.Next()
		}
		log.Printf("Non-WebSocket request received on WebSocket endpoint for user: %s", c.Params("id"))
		return fiber.ErrUpgradeRequired
	})

	app.Get("/ws/:id", websocket.New(handleWebSocket))
	app.Get("/generate-id", handleGenerateID)
	app.Get("/status/:id", handleUserStatus)
	app.Get("/messages/:userId", handleGetAllMessages)

	log.Printf("Server starting on :3000")
	log.Fatal(app.Listen(":3000"))
}

func initDB() {
	var err error
	db, err = sql.Open("sqlite3", "./messages.db")
	if err != nil {
		log.Fatal(err)
	}

	// Create messages table if it doesn't exist
	createTableSQL := `
	CREATE TABLE IF NOT EXISTS messages (
		id TEXT PRIMARY KEY,
		from_id TEXT,
		to_id TEXT,
		content TEXT,
		timestamp DATETIME,
		delivered BOOLEAN,
		read_status BOOLEAN
	);`

	_, err = db.Exec(createTableSQL)
	if err != nil {
		log.Fatal(err)
	}
}

func handleGetAllMessages(c *fiber.Ctx) error {
	userID := c.Params("userId")

	query := `
    SELECT id, from_id, to_id, content, timestamp, delivered, read_status
    FROM messages
    WHERE from_id = ? OR to_id = ?
    ORDER BY timestamp ASC
    `

	rows, err := db.Query(query, userID, userID)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{
			"error": "Failed to fetch messages",
		})
	}
	defer rows.Close()

	var messages []Message
	for rows.Next() {
		var msg Message
		err := rows.Scan(
			&msg.ID,
			&msg.FromID,
			&msg.ToID,
			&msg.Content,
			&msg.Timestamp,
			&msg.Delivered,
			&msg.ReadStatus,
		)
		if err != nil {
			continue
		}
		messages = append(messages, msg)
	}

	return c.JSON(messages)
}

func handleGenerateID(c *fiber.Ctx) error {
	// Generate a 4-character ID
	const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
	b := make([]byte, 4)
	for i := range b {
		b[i] = chars[rand.Intn(len(chars))]
	}
	return c.JSON(fiber.Map{
		"id": string(b),
	})
}

func handleUserStatus(c *fiber.Ctx) error {
	userID := c.Params("id")
	clientsMux.RLock()
	client, exists := clients[userID]
	clientsMux.RUnlock()

	return c.JSON(fiber.Map{
		"online": exists && client.IsOnline,
	})
}

func handleWebSocket(c *websocket.Conn) {
	userID := c.Params("id")
	log.Printf("New WebSocket connection established for user: %s", userID)

	// Register new client
	client := &Client{
		ID:       userID,
		Conn:     c,
		IsOnline: true,
	}

	clientsMux.Lock()
	clients[userID] = client
	log.Printf("Registered client. Total connected clients: %d", len(clients))
	clientsMux.Unlock()

	// Broadcast that user is online
	log.Printf("Broadcasting online status for user: %s", userID)
	broadcastUserStatus(userID, true)

	// Send all messages
	log.Printf("Sending all messages for user: %s", userID)
	sendAllMessages(userID)

	// Send current online users status
	log.Printf("Sending online users status to user: %s", userID)
	sendCurrentOnlineUsers(client)

	// WebSocket message handling loop
	for {
		var msg Message
		err := c.ReadJSON(&msg)
		if err != nil {
			log.Printf("Error reading message: %v", err)
			break
		}

		msg.Timestamp = time.Now()

		switch msg.Content {
		case "delivered":
			// Handle delivery confirmation
			updateMessageStatus(msg.ToID, true, false)
			delivered := deliverMessage(msg)
			if !delivered {
				storeMessage(msg)
			}
		case "read":
			// Handle read receipt
			updateMessageStatus(msg.ToID, true, true)
			delivered := deliverMessage(msg)
			if !delivered {
				storeMessage(msg)
			}
		default:
			msg.Status = "sent"
			delivered := deliverMessage(msg)
			if !delivered {
				storeMessage(msg)
			}
		}
	}

	// Cleanup when connection closes
	clientsMux.Lock()
	if client, exists := clients[userID]; exists {
		client.IsOnline = false
		delete(clients, userID)
	}
	clientsMux.Unlock()

	// Broadcast that user is offline
	broadcastUserStatus(userID, false)
}

func broadcastUserStatus(userID string, online bool) {
	statusMsg := Message{
		ID:      "status_" + userID,
		Content: "status_update",
		FromID:  userID,
		Status:  map[bool]string{true: "online", false: "offline"}[online],
	}

	clientsMux.RLock()
	defer clientsMux.RUnlock()

	// Broadcast to all connected clients except the user themselves
	for _, client := range clients {
		if client.IsOnline && client.ID != userID {
			client.Conn.WriteJSON(statusMsg)
		}
	}
}

func sendAllMessages(userID string) {
	query := `
    SELECT id, from_id, to_id, content, timestamp, delivered, read_status
    FROM messages
    WHERE from_id = ? OR to_id = ?
    ORDER BY timestamp ASC
    `

	rows, err := db.Query(query, userID, userID)
	if err != nil {
		log.Printf("Error querying all messages: %v", err)
		return
	}
	defer rows.Close()

	clientsMux.RLock()
	recipient := clients[userID]
	clientsMux.RUnlock()

	if recipient == nil {
		return
	}

	// Prepare a transaction for updating message status
	tx, err := db.Begin()
	if err != nil {
		log.Printf("Error starting transaction: %v", err)
		return
	}

	updateStmt, err := tx.Prepare(`
        UPDATE messages
        SET delivered = true
        WHERE id = ? AND to_id = ? AND delivered = false
    `)
	if err != nil {
		log.Printf("Error preparing update statement: %v", err)
		tx.Rollback()
		return
	}
	defer updateStmt.Close()

	for rows.Next() {
		var msg Message
		err := rows.Scan(
			&msg.ID,
			&msg.FromID,
			&msg.ToID,
			&msg.Content,
			&msg.Timestamp,
			&msg.Delivered,
			&msg.ReadStatus,
		)
		if err != nil {
			log.Printf("Error scanning message: %v", err)
			continue
		}

		// Send message to user
		err = recipient.Conn.WriteJSON(msg)
		if err != nil {
			log.Printf("Error sending message: %v", err)
			continue
		}

		// If this is a received message that hasn't been delivered yet
		if msg.ToID == userID && !msg.Delivered {
			// Mark as delivered in database
			_, err = updateStmt.Exec(msg.ID, userID)
			if err != nil {
				log.Printf("Error updating message status: %v", err)
				continue
			}

			// Send delivery confirmation to original sender
			deliveryConfirmation := Message{
				ID:        "delivery_" + msg.ID,
				FromID:    msg.ToID,
				ToID:      msg.FromID,
				Content:   "delivered",
				Timestamp: time.Now(),
				Delivered: true,
				Status:    "delivered",
			}

			clientsMux.RLock()
			sender := clients[msg.FromID]
			clientsMux.RUnlock()

			if sender != nil {
				sender.Conn.WriteJSON(deliveryConfirmation)
			}
		}
	}

	// Commit the transaction
	err = tx.Commit()
	if err != nil {
		log.Printf("Error committing transaction: %v", err)
		tx.Rollback()
	}
}

func sendCurrentOnlineUsers(newClient *Client) {
	clientsMux.RLock()
	defer clientsMux.RUnlock()

	// Send status of all online users to the new client
	for clientID, client := range clients {
		if client.IsOnline && clientID != newClient.ID {
			statusMsg := Message{
				ID:      "status_" + clientID,
				Content: "status_update",
				FromID:  clientID,
				Status:  "online",
			}
			newClient.Conn.WriteJSON(statusMsg)
		}
	}
}
func updateMessageStatus(messageID string, delivered bool, read bool) {
	query := `
    UPDATE messages 
    SET delivered = ?, read_status = ?
    WHERE id = ?
    `

	_, err := db.Exec(query, delivered, read, messageID)
	if err != nil {
		log.Printf("Error updating message status: %v", err)
	}
}

func deliverMessage(msg Message) bool {
	clientsMux.RLock()
	recipient, exists := clients[msg.ToID]
	clientsMux.RUnlock()

	if exists && recipient.IsOnline {
		err := recipient.Conn.WriteJSON(msg)
		if err != nil {
			log.Printf("Error sending message: %v", err)
			return false
		}

		// Send delivery confirmation to sender
		deliveryConfirmation := Message{
			ID:        "delivery_" + msg.ID, // Use the original message ID
			FromID:    msg.ToID,
			ToID:      msg.FromID,
			Content:   "delivered",
			Timestamp: time.Now(),
			Delivered: true,
			Status:    "delivered", // Add status
		}

		clientsMux.RLock()
		sender := clients[msg.FromID]
		clientsMux.RUnlock()

		if sender != nil {
			sender.Conn.WriteJSON(deliveryConfirmation)
		}

		return true
	}
	return false
}

func storeMessage(msg Message) {
	query := `
	INSERT INTO messages (id, from_id, to_id, content, timestamp, delivered, read_status)
	VALUES (?, ?, ?, ?, ?, ?, ?)
	`

	_, err := db.Exec(query,
		msg.ID,
		msg.FromID,
		msg.ToID,
		msg.Content,
		msg.Timestamp,
		msg.Delivered,
		msg.ReadStatus,
	)

	if err != nil {
		log.Printf("Error storing message: %v", err)
	}
}

func sendOfflineMessages(userID string) {
	// First, get all undelivered messages
	query := `
    SELECT id, from_id, to_id, content, timestamp, delivered, read_status
    FROM messages
    WHERE to_id = ? AND delivered = false
    `

	rows, err := db.Query(query, userID)
	if err != nil {
		log.Printf("Error querying offline messages: %v", err)
		return
	}
	defer rows.Close()

	clientsMux.RLock()
	recipient := clients[userID]
	clientsMux.RUnlock()

	// Prepare a transaction for updating multiple messages
	tx, err := db.Begin()
	if err != nil {
		log.Printf("Error starting transaction: %v", err)
		return
	}

	updateStmt, err := tx.Prepare(`
        UPDATE messages
        SET delivered = true
        WHERE id = ?
    `)
	if err != nil {
		log.Printf("Error preparing update statement: %v", err)
		tx.Rollback()
		return
	}
	defer updateStmt.Close()

	for rows.Next() {
		var msg Message
		err := rows.Scan(
			&msg.ID,
			&msg.FromID,
			&msg.ToID,
			&msg.Content,
			&msg.Timestamp,
			&msg.Delivered,
			&msg.ReadStatus,
		)
		if err != nil {
			log.Printf("Error scanning message: %v", err)
			continue
		}

		// Send stored message to now-online user
		if recipient != nil {
			err = recipient.Conn.WriteJSON(msg)
			if err != nil {
				log.Printf("Error sending stored message: %v", err)
				continue
			}

			// Mark message as delivered within the transaction
			_, err = updateStmt.Exec(msg.ID)
			if err != nil {
				log.Printf("Error updating message status: %v", err)
				continue
			}

			// Send delivery confirmation to original sender
			deliveryConfirmation := Message{
				ID:        "delivery_" + msg.ID,
				FromID:    msg.ToID,
				ToID:      msg.FromID,
				Content:   "delivered",
				Timestamp: time.Now(),
				Delivered: true,
			}

			clientsMux.RLock()
			sender := clients[msg.FromID]
			clientsMux.RUnlock()

			if sender != nil {
				sender.Conn.WriteJSON(deliveryConfirmation)
			}
		}
	}

	// Commit the transaction
	err = tx.Commit()
	if err != nil {
		log.Printf("Error committing transaction: %v", err)
		tx.Rollback()
	}
}
