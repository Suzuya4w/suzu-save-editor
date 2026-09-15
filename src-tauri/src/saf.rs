#[cfg(target_os = "android")]
use jni::{objects::{JObject, JValue}, JNIEnv};
#[cfg(target_os = "android")]
use std::sync::{Mutex, OnceLock};

#[cfg(target_os = "android")]
static FILE_PICKER_SENDER: OnceLock<Mutex<Option<tokio::sync::oneshot::Sender<Option<String>>>>> = OnceLock::new();
#[cfg(target_os = "android")]
static FOLDER_PICKER_SENDER: OnceLock<Mutex<Option<tokio::sync::oneshot::Sender<Option<String>>>>> = OnceLock::new();

#[cfg(target_os = "android")]
fn get_picker_sender() -> &'static Mutex<Option<tokio::sync::oneshot::Sender<Option<String>>>> {
    FILE_PICKER_SENDER.get_or_init(|| Mutex::new(None))
}

#[cfg(target_os = "android")]
fn get_folder_picker_sender() -> &'static Mutex<Option<tokio::sync::oneshot::Sender<Option<String>>>> {
    FOLDER_PICKER_SENDER.get_or_init(|| Mutex::new(None))
}

#[cfg(target_os = "android")]
#[unsafe(no_mangle)]
pub extern "C" fn Java_com_suzu_saveeditor_MainActivity_onFilePicked<'local>(
    mut env: JNIEnv<'local>,
    _class: JObject<'local>,
    uri: JObject<'local>,
) {
    let uri_string: Option<String> = if !uri.is_null() {
        if let Ok(string) = env.get_string((&uri).into()) {
            Some(string.into())
        } else {
            None
        }
    } else {
        None
    };

    if let Ok(mut lock) = get_picker_sender().lock() {
        if let Some(sender) = lock.take() {
            let _ = sender.send(uri_string);
        }
    }
}

#[cfg(target_os = "android")]
#[unsafe(no_mangle)]
pub extern "C" fn Java_com_suzu_saveeditor_MainActivity_onFolderPicked<'local>(
    mut env: JNIEnv<'local>,
    _class: JObject<'local>,
    uri: JObject<'local>,
) {
    let uri_string: Option<String> = if !uri.is_null() {
        if let Ok(string) = env.get_string((&uri).into()) {
            Some(string.into())
        } else {
            None
        }
    } else {
        None
    };

    if let Ok(mut lock) = get_folder_picker_sender().lock() {
        if let Some(sender) = lock.take() {
            let _ = sender.send(uri_string);
        }
    }
}

#[cfg(target_os = "android")]
pub fn write_content_uri(env: &mut JNIEnv, context: JObject, uri: &str, data: &[u8]) -> Result<(), String> {
    let uri_jstring = env.new_string(uri).map_err(|e| e.to_string())?;
    
    // Convert Rust &[u8] to JNI jbyteArray
    let byte_array = env.byte_array_from_slice(data).map_err(|e| e.to_string())?;

    let class = crate::shizuku::get_saf_api_class(env)?;
    
    let result = env.call_static_method(
        class,
        "writeContentUri",
        "(Landroid/content/Context;Ljava/lang/String;[B)Ljava/lang/String;",
        &[
            JValue::Object(&context),
            JValue::Object(&uri_jstring),
            JValue::Object(&byte_array),
        ],
    );

    if let Err(e) = result {
        let _ = env.exception_clear();
        return Err(e.to_string());
    }

    let result_jstring = result.unwrap().l().map_err(|e| e.to_string())?;
    let result_string: String = env.get_string((&result_jstring).into()).map_err(|e| e.to_string())?.into();

    if result_string == "SUCCESS" {
        Ok(())
    } else {
        Err(result_string)
    }
}

#[cfg(not(target_os = "android"))]
pub fn write_content_uri(_context: (), _uri: &str, _data: &[u8]) -> Result<(), String> {
    Err("SAF is only available on Android".to_string())
}

#[tauri::command]
pub fn write_content_uri_bytes(uri: String, bytes: Vec<u8>) -> Result<(), String> {
    #[cfg(target_os = "android")]
    {
        let vm = crate::shizuku::get_vm()?;
        let mut env = vm.attach_current_thread().map_err(|e| e.to_string())?;
        let context = crate::shizuku::get_application_context(&mut env)?;
        let context_copy = env.new_local_ref(context).map_err(|e| e.to_string())?;
        
        write_content_uri(&mut env, context_copy.into(), &uri, &bytes)
    }

    #[cfg(not(target_os = "android"))]
    {
        Err("SAF is only available on Android".to_string())
    }
}

#[tauri::command]
pub async fn pick_file_for_write() -> Result<Option<String>, String> {
    #[cfg(target_os = "android")]
    {
        let (tx, rx) = tokio::sync::oneshot::channel();
        if let Ok(mut lock) = get_picker_sender().lock() {
            *lock = Some(tx);
        } else {
            return Err("Failed to acquire lock".to_string());
        }

        {
            let vm = crate::shizuku::get_vm()?;
            let mut env = vm.attach_current_thread().map_err(|e| e.to_string())?;
            let class = crate::shizuku::get_saf_api_class(&mut env)?;
            let context = crate::shizuku::get_application_context(&mut env)?;
            let context_copy = env.new_local_ref(context).map_err(|e| e.to_string())?;

            let result = env.call_static_method(
                class,
                "pickFileForWrite",
                "(Landroid/content/Context;)V",
                &[jni::objects::JValue::Object(&context_copy)],
            );
            if let Err(e) = result {
                let _ = env.exception_clear();
                return Err(e.to_string());
            }
        }

        rx.await.map_err(|e| e.to_string())
    }

    #[cfg(not(target_os = "android"))]
    {
        Err("Native picker is only available on Android".to_string())
    }
}

#[tauri::command]
pub async fn pick_folder_for_export() -> Result<Option<String>, String> {
    #[cfg(target_os = "android")]
    {
        let (tx, rx) = tokio::sync::oneshot::channel();
        if let Ok(mut lock) = get_folder_picker_sender().lock() {
            *lock = Some(tx);
        } else {
            return Err("Failed to acquire lock".to_string());
        }

        {
            let vm = crate::shizuku::get_vm()?;
            let mut env = vm.attach_current_thread().map_err(|e| e.to_string())?;
            let class = crate::shizuku::get_saf_api_class(&mut env)?;
            let context = crate::shizuku::get_application_context(&mut env)?;
            let context_copy = env.new_local_ref(context).map_err(|e| e.to_string())?;

            let result = env.call_static_method(
                class,
                "pickFolderForExport",
                "(Landroid/content/Context;)V",
                &[jni::objects::JValue::Object(&context_copy)],
            );
            if let Err(e) = result {
                let _ = env.exception_clear();
                return Err(e.to_string());
            }
        }

        rx.await.map_err(|e| e.to_string())
    }

    #[cfg(not(target_os = "android"))]
    {
        Err("Native folder picker is only available on Android".to_string())
    }
}

#[tauri::command]
pub async fn copy_folder_to_tree(source_path: String, dest_tree_uri: String) -> Result<(), String> {
    #[cfg(target_os = "android")]
    {
        let vm = crate::shizuku::get_vm()?;
        let mut env = vm.attach_current_thread().map_err(|e| e.to_string())?;
        let class = crate::shizuku::get_saf_api_class(&mut env)?;
        let context = crate::shizuku::get_application_context(&mut env)?;
        let context_copy = env.new_local_ref(context).map_err(|e| e.to_string())?;

        let source_jstring = env.new_string(&source_path).map_err(|e| e.to_string())?;
        let dest_jstring = env.new_string(&dest_tree_uri).map_err(|e| e.to_string())?;

        let result = env.call_static_method(
            class,
            "copyFolderToTree",
            "(Landroid/content/Context;Ljava/lang/String;Ljava/lang/String;)Ljava/lang/String;",
            &[
                jni::objects::JValue::Object(&context_copy),
                jni::objects::JValue::Object(&source_jstring),
                jni::objects::JValue::Object(&dest_jstring),
            ],
        );

        if let Err(e) = result {
            let _ = env.exception_clear();
            return Err(e.to_string());
        }

        let result_jstring = result.unwrap().l().map_err(|e| e.to_string())?;
        let result_string: String = env.get_string((&result_jstring).into()).map_err(|e| e.to_string())?.into();

        if result_string == "SUCCESS" {
            Ok(())
        } else {
            Err(result_string)
        }
    }

    #[cfg(not(target_os = "android"))]
    {
        Err("Folder copy is only available on Android".to_string())
    }
}
