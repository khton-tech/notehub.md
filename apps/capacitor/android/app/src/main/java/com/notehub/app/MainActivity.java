package com.notehub.app;

import android.os.Bundle;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.Settings;
import android.app.AlertDialog;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    private static final int REQUEST_MANAGE_ALL_FILES = 1001;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        checkAndRequestFilePermission();
    }

    private void checkAndRequestFilePermission() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            if (!Environment.isExternalStorageManager()) {
                showPermissionRationaleDialog();
            }
        }
    }

    private void showPermissionRationaleDialog() {
        new AlertDialog.Builder(this)
                .setTitle("File Access Required")
                .setMessage(
                        "Notehub needs access to manage all files to read and write your notes. Please grant this permission in the next screen.")
                .setPositiveButton("Continue", (dialog, which) -> {
                    Intent intent = new Intent(Settings.ACTION_MANAGE_APP_ALL_FILES_ACCESS_PERMISSION);
                    Uri uri = Uri.fromParts("package", getPackageName(), null);
                    intent.setData(uri);
                    startActivityForResult(intent, REQUEST_MANAGE_ALL_FILES);
                })
                .setNegativeButton("Exit", (dialog, which) -> {
                    finish();
                })
                .setCancelable(false)
                .show();
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);

        if (requestCode == REQUEST_MANAGE_ALL_FILES) {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                if (!Environment.isExternalStorageManager()) {
                    // Permission was denied, show dialog again
                    showPermissionDeniedDialog();
                }
            }
        }
    }

    private void showPermissionDeniedDialog() {
        new AlertDialog.Builder(this)
                .setTitle("Permission Required")
                .setMessage(
                        "Notehub cannot function without file access permission. Please grant the permission to continue.")
                .setPositiveButton("Try Again", (dialog, which) -> {
                    showPermissionRationaleDialog();
                })
                .setNegativeButton("Exit", (dialog, which) -> {
                    finish();
                })
                .setCancelable(false)
                .show();
    }
}
