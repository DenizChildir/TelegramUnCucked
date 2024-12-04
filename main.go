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
		// Enable WebSocket upgrade for all paths
		if websocket.IsWebSocketUpgrade(c) {
			c.Locals("allowed", true)
			return c.Next()
		}
		return fiber.ErrUpgradeRequired
	})

	app.Get("/ws/:id", websocket.New(handleWebSocket))
	app.Get("/generate-id", handleGenerateID)
	app.Get("/status/:id", handleUserStatus)

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

	// Register new client
	client := &Client{
		ID:       userID,
		Conn:     c,
		IsOnline: true,
	}

	clientsMux.Lock()
	clients[userID] = client
	clientsMux.Unlock()

	// Send offline messages when user connects
	sendOfflineMessages(userID)

	// WebSocket message handling loop
	for {
		var msg Message
		err := c.ReadJSON(&msg)
		if err != nil {
			log.Printf("Error reading message: %v", err)
			break
		}

		msg.Timestamp = time.Now()
		msg.Delivered = false

		// Try to deliver message
		delivered := deliverMessage(msg)
		if !delivered {
			// Store message in database if recipient is offline
			storeMessage(msg)
		}
	}

	// Cleanup when connection closes
	clientsMux.Lock()
	delete(clients, userID)
	clientsMux.Unlock()
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

			// Update message as delivered
			updateQuery := `
			UPDATE messages
			SET delivered = true
			WHERE id = ?
			`
			_, err = db.Exec(updateQuery, msg.ID)
			if err != nil {
				log.Printf("Error updating message status: %v", err)
			}
		}
	}
}
