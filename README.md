# Backend Running


1. Navigate to the backend directory:

    ```
    cd backend
    ```

2. Create a virtual environment:

    ```
    python3 -m venv venv
    ```

3. Activate the virtual environment:

    **Linux**:

    ```
    source venv/bin/activate
    ```

    **Windows**:

    ```
    ./venv/Scripts/activate
    ```

4. Download all requirements:

    ```
    pip3 install -r requirements.txt
    ```

5. Run uvicorn server with port 8008:

    ```
    uvicorn main:app --port 8008
    ```

  **Note:** Use the `--reload` flag for automated reloading of the server after each change.


## Run S3 locally

    ```
    docker pull scireum/s3-ninja
    docker run -d -p 9444:9000 -v /mnt/s3-ninja:/home/sirius/data scireum/s3-ninja:latest
    ```

Create, setup bucket and get your auth data here: http://localhost:9444/ui
Don't forget to set correct chmod for your volume if you want to use it (/mnt/s3-ninja)

# Frontend

Frontend uses [vite](https://vitejs.dev/) as dev environment.


1. Navigate to the frontend directory:

    ```
    cd frontend
    ```

2. Install dependencies

    ```
    npm i
    ```

3. Start dev server (with hot reload)

    ```
    npm run dev
    ```

4. Build

    ```
    npm run build
    ```
