# AI Usage Documentation

## AI Tools Used

The primary AI tool used during development was Cursor as a development assistant for:
- validating system architecture and backend API structure
- reviewing concurrency handling approaches
- frontend formatting

All final implementation decisions and code verification were done manually. Most code was written manually.


## Areas Where AI Helped

### Backend Architecture

The initial architecture of React, FastAPI, and SQLAlchemy was created by me, but Cursor suggested code to organize the API routes, request/response schemas, and transaction processing logic.

### Concurrency Handling

AI was used to discuss safe handling of concurrent transactions and database locking strategies. This was especially useful for understanding database transactions, row-level locking, and `SELECT FOR UPDATE`.

### Frontend Formatting

Cursor was used to help refine frontend layout and usability. It assisted with providing code for adjusting button placement, improving spacing, and section organization to make the main user workflows easier to navigate.


## Example AI Workflows

### Example 1: Backend API Organization

Prompt: How should I organize the API routes, database setup, request/response schemas, and transaction models for an HSA account simulation app using FastAPI and SQLAlchemy?

AI suggested separating the backend into distinct files based on responsibility instead of keeping all logic in one large file. My final backend app structure was:

- database.py handles database configuration, async engine setup, session creation, and the shared SQLAlchemy Base
- schemas.py defines request and response models such as AccountCreate, DepositCreate, PurchaseCreate, and TransactionOut
- models.py defines SQLAlchemy database models such as Account, Card, and Transaction
- accounts.py contains the account-related API routes for creating accounts, depositing funds, issuing cards, simulating purchases, and listing transactions

Cursor helped clarify that SQLAlchemy models and Pydantic schemas should stay separate. This made the code easier to debug, maintain, and add to because database structure, API validation, and route logic each had a clear place.


### Example 2: Understanding `SELECT FOR UPDATE`

Prompt: What is the atomic lock equivalent in Python? What does SELECT FOR UPDATE do, and how does it successfully handle concurrent transactions for account balances?

Cursor generated code that integrated SELECT FOR UPDATE, and it explained how row-level locking works during database transactions. This improved my understanding of safe concurrency handling and helped guide the final implementation.


## Example of Incorrect or Incomplete AI Output

One example where AI output was incomplete was database concurrency handling. In the beginning, Cursor suggested that wrapping transaction logic in a SQLite database transaction was enough to safely handle concurrent purchases. However, after reviewing the approach more carefully and testing manually, I realized that transactions alone would not fully prevent race conditions if two requests read the same account balance before either update was committed.

To address this, I updated the implementation to use row-level locking with:

```python
.with_for_update()
```

This ensured that only one transaction can modify a specific account balance at a time and prevented simultaneous purchases from overdrafting the account.


## Verification Process

All AI-generated ideas and code were reviewed manually before committing. I manually wrote comments explaining any lines of AI-generated code to verify logic and accuracy. After pushing to Git, functionality was manually verified by testing the following on the website:
- account creation
- deposits
- card issuing
- approved purchases
- declined purchases
- insufficient funds
- concurrent transaction scenarios
