package main

import (
	"database/sql"
	"github.com/gofiber/fiber/v2/middleware/cors"
	"log"
	"math/rand"
	"os"
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
	log.Printf("🚀 Starting server initialization...")

	initDB()

	app := fiber.New()

	// CORS
	app.Use(cors.New(cors.Config{
		AllowOrigins: "*",
		AllowHeaders: "*",
		AllowMethods: "GET,POST,HEAD,PUT,DELETE,PATCH,OPTIONS",
	}))

	// Simple test endpoint
	app.Get("/ping", func(c *fiber.Ctx) error {
		return c.SendString("pong")
	})

	// WebSocket route
	app.Get("/ws/:id", websocket.New(func(c *websocket.Conn) {
		userID := c.Params("id")
		log.Printf("New WebSocket connection attempt from user: %s", userID)

		// Use your existing handleWebSocket function
		handleWebSocket(c)
	}))

	port := os.Getenv("PORT")
	if port == "" {
		port = "3000"
	}

	log.Printf("Server starting on port %s", port)
	log.Fatal(app.Listen(":" + port))
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
        read_status BOOLEAN,
        status TEXT DEFAULT 'sent'
    );`

	_, err = db.Exec(createTableSQL)
	if err != nil {
		log.Fatal(err)
	}
}

func handleDeleteMessages(c *fiber.Ctx) error {
	userID := c.Params("userId")
	contactID := c.Params("contactId")

	// Start a transaction
	tx, err := db.Begin()
	if err != nil {
		return c.Status(500).JSON(fiber.Map{
			"error": "Failed to start transaction",
		})
	}

	// Delete messages in both directions
	deleteQuery := `
        DELETE FROM messages 
        WHERE (from_id = ? AND to_id = ?) 
           OR (from_id = ? AND to_id = ?)
    `

	_, err = tx.Exec(deleteQuery, userID, contactID, contactID, userID)
	if err != nil {
		tx.Rollback()
		return c.Status(500).JSON(fiber.Map{
			"error": "Failed to delete messages",
		})
	}

	// Commit the transaction
	err = tx.Commit()
	if err != nil {
		tx.Rollback()
		return c.Status(500).JSON(fiber.Map{
			"error": "Failed to commit transaction",
		})
	}

	return c.JSON(fiber.Map{
		"success": true,
	})
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
	log.Printf("👤 New WebSocket connection established for user: %s", userID)

	// Register new client
	client := &Client{
		ID:       userID,
		Conn:     c,
		IsOnline: true,
	}

	clientsMux.Lock()
	clients[userID] = client
	log.Printf("✅ Registered client. Total connected clients: %d", len(clients))
	clientsMux.Unlock()

	// Broadcast that user is online
	log.Printf("📢 Broadcasting online status for user: %s", userID)
	broadcastUserStatus(userID, true)

	// Send all messages
	log.Printf("📨 Sending all messages for user: %s", userID)
	sendAllMessages(userID)

	// Send current online users status
	log.Printf("👥 Sending online users status to user: %s", userID)
	sendCurrentOnlineUsers(client)

	// WebSocket message handling loop
	for {
		var msg Message
		err := c.ReadJSON(&msg)
		if err != nil {
			log.Printf("❌ Error reading message: %v", err)
			break
		}

		// Ensure timestamp is set
		if msg.Timestamp.IsZero() {
			msg.Timestamp = time.Now()
			log.Printf("⏰ Set timestamp for message: %s", msg.ID)
		}

		// Ensure status is set
		if msg.Status == "" {
			msg.Status = "sent"
			log.Printf("📝 Set default status for message: %s", msg.ID)
		}

		log.Printf("📩 Received message - ID: %s, From: %s, To: %s, Content: %s, Status: %s",
			msg.ID, msg.FromID, msg.ToID, msg.Content, msg.Status)

		switch msg.Content {
		case "delivered":
			log.Printf("📬 Processing delivery confirmation for message: %s", msg.ID)
			updateMessageStatus(msg.ToID, true, false)
			msg.Status = "delivered"
			delivered := deliverMessage(msg)
			if !delivered {
				log.Printf("💾 Storing undelivered confirmation message: %s", msg.ID)
				storeMessage(msg)
			}

		case "read":
			log.Printf("👀 Processing read receipt for message: %s", msg.ID)
			updateMessageStatus(msg.ToID, true, true)
			msg.Status = "read"
			delivered := deliverMessage(msg)
			if !delivered {
				log.Printf("💾 Storing undelivered read receipt: %s", msg.ID)
				storeMessage(msg)
			}

		default:
			log.Printf("💬 Processing regular message: %s", msg.ID)
			delivered := deliverMessage(msg)
			if !delivered {
				log.Printf("💾 Storing undelivered message: %s", msg.ID)
				storeMessage(msg)
			}
		}
	}

	// Cleanup when connection closes
	log.Printf("👋 Connection closing for user: %s", userID)
	clientsMux.Lock()
	if client, exists := clients[userID]; exists {
		client.IsOnline = false
		delete(clients, userID)
		log.Printf("✅ Client removed from active clients. Remaining clients: %d", len(clients))
	}
	clientsMux.Unlock()

	// Broadcast that user is offline
	log.Printf("📢 Broadcasting offline status for user: %s", userID)
	broadcastUserStatus(userID, false)
}
func broadcastUserStatus(userID string, online bool) {
	log.Printf("Broadcasting status for user %s: %v", userID, online)

	statusMsg := Message{
		ID:      "status_" + userID,
		Content: "status_update",
		FromID:  userID,
		Status:  map[bool]string{true: "online", false: "offline"}[online],
	}

	clientsMux.RLock()
	defer clientsMux.RUnlock()

	// Broadcast to all connected clients except the user themselves
	for id, client := range clients {
		if client.IsOnline && id != userID {
			log.Printf("Sending status update to user %s", id)
			err := client.Conn.WriteJSON(statusMsg)
			if err != nil {
				log.Printf("Error sending status to %s: %v", id, err)
			}
		}
	}
}

func sendCurrentOnlineUsers(newClient *Client) {
	log.Printf("Sending current online users to %s", newClient.ID)

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
			err := newClient.Conn.WriteJSON(statusMsg)
			if err != nil {
				log.Printf("Error sending online status of %s: %v", clientID, err)
			}
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

		// Send delivery confirmation to sender if this is a regular message
		if msg.Content != "delivered" && msg.Content != "read" {
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

		// If this is a read receipt, update the message status in the database
		if msg.Content == "read" {
			updateMessageStatus(msg.ID, true, true)
		}

		return true
	}
	return false
}

func storeMessage(msg Message) {
	query := `
    INSERT INTO messages (id, from_id, to_id, content, timestamp, delivered, read_status, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `

	_, err := db.Exec(query,
		msg.ID,
		msg.FromID,
		msg.ToID,
		msg.Content,
		msg.Timestamp,
		msg.Delivered,
		msg.ReadStatus,
		msg.Status,
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
